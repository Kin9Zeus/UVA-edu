import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));

import { validarCodigoCupon } from "@/actions/cupones/validar";

/**
 * `validarCodigoCupon` + `buscarCuponVigente` — AUDIT-2026-09-15.md, P2-8
 * Fase 3, y la regresión de P2-1 de la misma auditoría (rate limit).
 *
 * Lo que importa aquí no es el cálculo del descuento (ya lo cubre
 * lib/pagos/descuento.test.ts) sino que la validación NO sea un oráculo:
 * que no se pueda distinguir "no existe" de "vencido" sin gastar un intento,
 * y que estando bloqueado no se consulte la tabla.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const PLAN = { precio_centavos: 50_000_000, moneda: "COP" };
const MANANA = new Date(Date.now() + 86_400_000).toISOString();
const AYER = new Date(Date.now() - 86_400_000).toISOString();

function cupon(campos: Record<string, unknown> = {}) {
  return {
    id: "cupon-1",
    tipo_descuento: "PORCENTAJE",
    valor: 20,
    fecha_vencimiento: MANANA,
    limite_usos: null,
    veces_usado: 0,
    ...campos,
  };
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  servidorFalso.responder("from:planes", { data: PLAN });
  servidorFalso.responder("rpc:verificar_limite_validar_cupon", {
    data: { permitido: true, segundos_espera: 0 },
  });
});

describe("antes del rate limit", () => {
  it("un código vacío no toca la base", async () => {
    expect(await validarCodigoCupon("plan-1", "  ")).toEqual({ ok: false, error: "Escribe un código." });
    expect(servidorFalso.clientesCreados).toEqual({ sesion: 0, admin: 0 });
  });

  it("sin sesión no consulta cupones", async () => {
    servidorFalso.conUsuario(null);

    const resultado = await validarCodigoCupon("plan-1", "PROMO20");

    expect(resultado).toMatchObject({ ok: false, error: expect.stringMatching(/sesión expiró/) });
    expect(servidorFalso.clientesCreados.admin).toBe(0);
  });

  it("un plan inactivo o inexistente responde antes de gastar un intento", async () => {
    servidorFalso.responder("from:planes", { data: null });

    const resultado = await validarCodigoCupon("plan-x", "PROMO20");

    expect(resultado).toEqual({ ok: false, error: "Ese plan ya no está disponible." });
    expect(servidorFalso.encadenado("from:planes", "eq")).toEqual([
      ["id", "plan-x"],
      ["activo", true],
    ]);
    expect(servidorFalso.llamadasA("rpc:verificar_limite_validar_cupon")).toHaveLength(0);
  });
});

describe("rate limit (P2-1)", () => {
  it("se cuenta por el id de la sesión", async () => {
    servidorFalso.responder("from:cupones", { data: cupon() });

    await validarCodigoCupon("plan-1", "PROMO20");

    expect(servidorFalso.argumentosDe("rpc:verificar_limite_validar_cupon")).toEqual({
      p_usuario_id: ESTUDIANTE.id,
    });
  });

  it("bloqueado: devuelve la espera y NO consulta la tabla de cupones", async () => {
    servidorFalso.responder("rpc:verificar_limite_validar_cupon", {
      data: { permitido: false, segundos_espera: 600 },
    });

    const resultado = await validarCodigoCupon("plan-1", "PROMO20");

    expect(resultado).toEqual({
      ok: false,
      error: "Demasiados intentos. Espera un momento antes de volver a intentar.",
      segundosEspera: 600,
    });
    expect(servidorFalso.llamadasA("from:cupones")).toHaveLength(0);
  });

  it("si el chequeo del límite falla, no consulta cupones (falla cerrado)", async () => {
    servidorFalso.responder("rpc:verificar_limite_validar_cupon", { data: null, error: { message: "x" } });

    const resultado = await validarCodigoCupon("plan-1", "PROMO20");

    expect(resultado.ok).toBe(false);
    expect(servidorFalso.llamadasA("from:cupones")).toHaveLength(0);
  });
});

describe("cupón inválido: todos los rechazos cuestan un intento", () => {
  // Si "no existe" no contara y "vencido" sí (o al revés), la diferencia
  // de comportamiento sería el oráculo que P2-1 vino a cerrar.
  it.each([
    ["no existe", null, "Ese cupón no existe."],
    ["vencido", cupon({ fecha_vencimiento: AYER }), "Ese cupón ya venció."],
    ["agotado", cupon({ limite_usos: 5, veces_usado: 5 }), "Ese cupón ya alcanzó su límite de usos."],
  ])("%s", async (_caso, fila, mensaje) => {
    servidorFalso.responder("from:cupones", { data: fila });

    expect(await validarCodigoCupon("plan-1", "PROMO20")).toEqual({ ok: false, error: mensaje });
    expect(servidorFalso.argumentosDe("rpc:registrar_validacion_cupon_fallida")).toEqual({
      p_usuario_id: ESTUDIANTE.id,
    });
    expect(servidorFalso.llamadasA("rpc:limpiar_intentos_validar_cupon")).toHaveLength(0);
  });

  it("un error de la consulta también cuesta un intento", async () => {
    servidorFalso.responder("from:cupones", { data: null, error: { message: "boom" } });

    await validarCodigoCupon("plan-1", "PROMO20");

    expect(servidorFalso.llamadasA("rpc:registrar_validacion_cupon_fallida")).toHaveLength(1);
  });
});

describe("cupón válido", () => {
  it("devuelve el desglose con el precio de la base y limpia los intentos", async () => {
    servidorFalso.responder("from:cupones", { data: cupon() });

    const resultado = await validarCodigoCupon("plan-1", "  PROMO20 ");

    expect(resultado).toMatchObject({ ok: true, desglose: { totalCentavos: 40_000_000 } });
    expect(servidorFalso.encadenado("from:cupones", "eq")).toEqual([["codigo", "PROMO20"]]);
    expect(servidorFalso.argumentosDe("rpc:limpiar_intentos_validar_cupon")).toEqual({
      p_usuario_id: ESTUDIANTE.id,
    });
    expect(servidorFalso.llamadasA("rpc:registrar_validacion_cupon_fallida")).toHaveLength(0);
  });

  it("un cupón que cubre el 100% se rechaza: para eso están los códigos de invitación", async () => {
    servidorFalso.responder("from:cupones", { data: cupon({ valor: 100 }) });

    expect(await validarCodigoCupon("plan-1", "GRATIS")).toEqual({
      ok: false,
      error: "Ese cupón cubre el plan completo. Pídenos un código de invitación.",
    });
  });
});
