import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { iniciarCheckout } from "@/actions/suscripciones/checkout";
import { logError } from "@/lib/log";

/**
 * `iniciarCheckout` — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * El módulo de pagos está en demo (addendum de la auditoría), pero esta es
 * la acción que la auditoría nombra: "un refactor en checkout no tiene
 * ninguna red de seguridad". Lo que se protege aquí son las reglas que, si
 * se rompen, cobran mal:
 *   · el monto que se firma sale del plan en la BASE y del cupón validado,
 *     nunca de algo que mande el navegador;
 *   · no se cobra a quien ya tiene acceso, ni a una cuenta sin confirmar;
 *   · el intento de pago queda registrado ANTES de mandar a Wompi, con el
 *     id de la sesión — el webhook lo necesita para conciliar.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co", email_confirmed_at: "2026-09-01T00:00:00Z" };
const PLAN = { id: "plan-1", nombre: "Anual", precio_centavos: 50_000_000, moneda: "COP", activo: true };
const MANANA = new Date(Date.now() + 86_400_000).toISOString();

/** Ejecuta el checkout; si redirige, devuelve la URL de destino ya parseada. */
async function checkout(codigoCupon?: string): Promise<{ resultado?: unknown; destino?: URL }> {
  try {
    return { resultado: await iniciarCheckout("plan-1", codigoCupon) };
  } catch (error) {
    if (error instanceof RedireccionFalsa) return { destino: new URL(error.destino) };
    throw error;
  }
}

function filaInsertada(): Record<string, unknown> {
  const inserts = servidorFalso.encadenado("from:intentos_pago", "insert");
  expect(inserts).toHaveLength(1);
  return inserts[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  servidorFalso.responder("from:suscripciones", { data: null });
  servidorFalso.responder("from:planes", { data: PLAN });
  servidorFalso.responder("rpc:verificar_limite_validar_cupon", {
    data: { permitido: true, segundos_espera: 0 },
  });
  vi.stubEnv("WOMPI_SIMULADOR", "");
  vi.stubEnv("WOMPI_PUB_KEY", "pub_test_x");
  vi.stubEnv("WOMPI_PRV_KEY", "prv_test_x");
  vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_x");
  vi.mocked(logError).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("quién puede pagar", () => {
  it("sin sesión no consulta nada más", async () => {
    servidorFalso.conUsuario(null);

    expect((await checkout()).resultado).toEqual({ error: "Tu sesión expiró. Vuelve a iniciar sesión." });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
  });

  it("una cuenta sin correo confirmado no llega a leer el plan", async () => {
    servidorFalso.conUsuario({ ...ESTUDIANTE, email_confirmed_at: null });

    expect((await checkout()).resultado).toEqual({ error: "Confirma tu correo antes de suscribirte." });
    expect(servidorFalso.llamadasA("from:planes")).toHaveLength(0);
  });

  it("con una membresía vigente no se cobra de nuevo", async () => {
    servidorFalso.responder("from:suscripciones", {
      data: { estado: "ACTIVA", fecha_renovacion: MANANA, acceso_manual: false, plan: { nombre: "Anual" } },
    });

    expect((await checkout()).resultado).toEqual({ error: "Ya tienes una suscripción activa." });
    expect(servidorFalso.encadenado("from:suscripciones", "eq")).toEqual([["id_usuario", ESTUDIANTE.id]]);
    expect(servidorFalso.llamadasA("from:intentos_pago")).toHaveLength(0);
  });

  it("una fila ACTIVA pero vencida por fecha NO bloquea la compra", async () => {
    // El callejón sin salida que documenta buscarMembresiaVigente: el checkout
    // lo veía "vigente" y lo rebotaba, y la suscripción lo mandaba a comprar.
    servidorFalso.responder("from:suscripciones", {
      data: { estado: "ACTIVA", fecha_renovacion: "2020-01-01T00:00:00Z", acceso_manual: false, plan: null },
    });

    expect((await checkout()).destino).toBeInstanceOf(URL);
  });
});

describe("el plan", () => {
  it("un plan inactivo o inexistente no se cobra", async () => {
    servidorFalso.responder("from:planes", { data: null });

    expect((await checkout()).resultado).toEqual({ error: "Ese plan ya no está disponible." });
    expect(servidorFalso.encadenado("from:planes", "eq")).toEqual([
      ["id", "plan-1"],
      ["activo", true],
    ]);
    expect(servidorFalso.llamadasA("from:intentos_pago")).toHaveLength(0);
  });

  it("un plan con moneda inválida no se cobra y deja rastro", async () => {
    servidorFalso.responder("from:planes", { data: { ...PLAN, moneda: "pesos" } });

    expect((await checkout()).resultado).toEqual({ error: "Ese plan no se puede cobrar ahora mismo. Escríbenos." });
    expect(logError).toHaveBeenCalledWith(
      "iniciarCheckout",
      "plan con moneda inválida",
      null,
      expect.objectContaining({ area: "pagos" }),
    );
    expect(servidorFalso.llamadasA("from:intentos_pago")).toHaveLength(0);
  });
});

describe("cupón en el checkout", () => {
  it("pasa por el mismo rate limit que la validación en vivo (P2-1)", async () => {
    // Si el checkout no contara, la validación limitada se podía saltar
    // probando códigos directamente al pagar.
    servidorFalso.responder("rpc:verificar_limite_validar_cupon", {
      data: { permitido: false, segundos_espera: 600 },
    });

    const { resultado } = await checkout("PROMO20");

    expect(resultado).toEqual({ error: "Demasiados intentos. Espera un momento antes de volver a intentar." });
    expect(servidorFalso.argumentosDe("rpc:verificar_limite_validar_cupon")).toEqual({
      p_usuario_id: ESTUDIANTE.id,
    });
    expect(servidorFalso.llamadasA("from:intentos_pago")).toHaveLength(0);
  });

  it("un cupón inválido no registra intento de pago", async () => {
    servidorFalso.responder("from:cupones", { data: null });

    expect((await checkout("NOEXISTE")).resultado).toEqual({ error: "Ese cupón no existe." });
    expect(servidorFalso.llamadasA("from:intentos_pago")).toHaveLength(0);
  });

  it("un cupón que cubre el 100% no se cobra (pagar 0 en Wompi no existe)", async () => {
    servidorFalso.responder("from:cupones", {
      data: { id: "c", tipo_descuento: "PORCENTAJE", valor: 100, fecha_vencimiento: MANANA, limite_usos: null, veces_usado: 0 },
    });

    expect((await checkout("GRATIS")).resultado).toEqual({
      error: "Ese cupón cubre el plan completo. Pídenos un código de invitación.",
    });
    expect(servidorFalso.llamadasA("from:intentos_pago")).toHaveLength(0);
  });
});

describe("cobro", () => {
  it("sin cupón: registra el intento con el precio de la base y firma ese mismo monto", async () => {
    const { destino } = await checkout();

    const fila = filaInsertada();
    expect(fila).toMatchObject({
      id_usuario: ESTUDIANTE.id,
      id_plan: "plan-1",
      id_cupon: null,
      monto_centavos: 50_000_000,
      moneda: "COP",
      estado: "PENDIENTE",
    });
    expect(servidorFalso.llamadasA("from:intentos_pago")[0].cliente).toBe("admin");

    expect(destino?.origin).toBe("https://checkout.wompi.co");
    expect(destino?.searchParams.get("amount-in-cents")).toBe("50000000");
    expect(destino?.searchParams.get("currency")).toBe("COP");
    // La referencia que viaja a Wompi es la misma que quedó guardada: el
    // webhook solo trae la referencia para conciliar.
    expect(destino?.searchParams.get("reference")).toBe(fila.referencia);
    expect(destino?.searchParams.get("customer-data:email")).toBe(ESTUDIANTE.email);
    expect(destino?.searchParams.get("redirect-url")).toBe(
      `http://localhost:3000/dashboard/suscripcion?ref=${fila.referencia}`,
    );
  });

  it("con cupón del 20%: registra y firma el total con descuento, y guarda el cupón", async () => {
    servidorFalso.responder("from:cupones", {
      data: { id: "cupon-20", tipo_descuento: "PORCENTAJE", valor: 20, fecha_vencimiento: MANANA, limite_usos: null, veces_usado: 0 },
    });

    const { destino } = await checkout("PROMO20");

    expect(filaInsertada()).toMatchObject({ id_cupon: "cupon-20", monto_centavos: 40_000_000 });
    expect(destino?.searchParams.get("amount-in-cents")).toBe("40000000");
  });

  it("cada checkout genera una referencia nueva", async () => {
    await checkout();
    await checkout();

    const [primera, segunda] = servidorFalso
      .encadenado("from:intentos_pago", "insert")
      .map((args) => (args[0] as { referencia: string }).referencia);
    expect(primera).toMatch(/^uva_[0-9a-f]{32}$/);
    expect(primera).not.toBe(segunda);
  });

  it("sin credenciales de Wompi no registra un intento que nunca se podría pagar", async () => {
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "");

    expect((await checkout()).resultado).toEqual({ error: "Los pagos no están disponibles ahora mismo. Escríbenos." });
    expect(servidorFalso.llamadasA("from:intentos_pago")).toHaveLength(0);
  });

  it("si no se puede guardar el intento, no manda a pagar", async () => {
    // Un pago sin fila de intento es un pago que el webhook no puede conciliar.
    servidorFalso.responder("from:intentos_pago", { error: { message: "insert falló" } });

    const { resultado, destino } = await checkout();

    expect(resultado).toEqual({ error: "No pudimos iniciar el pago. Intenta de nuevo." });
    expect(destino).toBeUndefined();
  });
});
