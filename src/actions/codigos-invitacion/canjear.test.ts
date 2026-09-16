import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/resend", () => ({ enviarCorreoBienvenida: vi.fn() }));

import { canjearCodigoInvitacion } from "@/actions/codigos-invitacion/canjear";
import { enviarCorreoBienvenida } from "@/lib/resend";
import { logError } from "@/lib/log";

/**
 * `canjearCodigoInvitacion` — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * La validación del código (vigencia, límite, doble canje) y la creación de
 * la suscripción viven en `canjear_codigo_invitacion()` y las prueba
 * `npm run test:canje` contra la base. Esto prueba lo que esa prueba no ve:
 * la capa TypeScript que decide QUÉ se le pide a la base, con qué id y en
 * qué orden — que es donde un refactor rompe cosas sin que ninguna función
 * SQL cambie.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };

function limitePermitido() {
  servidorFalso.responder("rpc:verificar_limite_canjear_codigo", {
    data: { permitido: true, segundos_espera: 0 },
  });
}

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(enviarCorreoBienvenida).mockReset().mockResolvedValue({ success: true, id: "correo-1" });
  vi.mocked(logError).mockClear();
});

describe("antes de tocar la base", () => {
  it("un código vacío o de solo espacios no gasta ninguna consulta", async () => {
    servidorFalso.conUsuario(ESTUDIANTE);

    expect(await canjearCodigoInvitacion("   ")).toEqual({ error: "Ingresa un código." });
    expect(servidorFalso.clientesCreados).toEqual({ sesion: 0, admin: 0 });
  });

  it("sin sesión no se crea el cliente de Service Role", async () => {
    servidorFalso.conUsuario(null);

    const resultado = await canjearCodigoInvitacion("UVA-2026");

    expect(resultado.error).toMatch(/sesión expiró/);
    expect(servidorFalso.clientesCreados.admin).toBe(0);
  });
});

describe("rate limit (P2-2 de AUDIT-2026-08-24)", () => {
  beforeEach(() => servidorFalso.conUsuario(ESTUDIANTE));

  it("se cuenta por el id de la SESIÓN, no por nada que mande el cliente", async () => {
    limitePermitido();
    servidorFalso.responder("rpc:canjear_codigo_invitacion", { data: { ok: true, motivo: null } });

    await canjearCodigoInvitacion("UVA-2026");

    expect(servidorFalso.argumentosDe("rpc:verificar_limite_canjear_codigo")).toEqual({
      p_usuario_id: ESTUDIANTE.id,
    });
    expect(servidorFalso.argumentosDe("rpc:canjear_codigo_invitacion")).toEqual({
      p_codigo: "UVA-2026",
      p_usuario_id: ESTUDIANTE.id,
    });
  });

  it("bloqueado: devuelve la espera y NO intenta el canje ni suma otro intento", async () => {
    servidorFalso.responder("rpc:verificar_limite_canjear_codigo", {
      data: { permitido: false, segundos_espera: 420 },
    });

    const resultado = await canjearCodigoInvitacion("UVA-2026");

    expect(resultado).toEqual({
      error: "Demasiados intentos. Espera un momento antes de volver a intentar.",
      segundosEspera: 420,
    });
    // Si probara el código estando bloqueado, el límite no limitaría nada.
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser", "rpc:verificar_limite_canjear_codigo"]);
  });

  it("si el chequeo del límite falla, no canjea (falla cerrado)", async () => {
    servidorFalso.responder("rpc:verificar_limite_canjear_codigo", {
      data: null,
      error: { message: "timeout" },
    });

    const resultado = await canjearCodigoInvitacion("UVA-2026");

    expect(resultado.error).toMatch(/No pudimos procesar/);
    expect(servidorFalso.llamadasA("rpc:canjear_codigo_invitacion")).toHaveLength(0);
  });
});

describe("canje rechazado", () => {
  beforeEach(() => {
    servidorFalso.conUsuario(ESTUDIANTE);
    limitePermitido();
  });

  it.each([
    ["codigo_invalido", "Ese código no existe."],
    ["codigo_inactivo", "Ese código ya no está activo."],
    ["codigo_vencido", "Ese código venció."],
    ["codigo_agotado", "Ese código ya alcanzó su límite de usos."],
    ["ya_canjeado", "Ya canjeaste este código antes."],
    ["ya_tiene_suscripcion", "Ya tienes una suscripción activa. Podrás canjear este código cuando termine, si sigue vigente."],
  ])("motivo %s → mensaje propio y suma un intento fallido", async (motivo, mensaje) => {
    servidorFalso.responder("rpc:canjear_codigo_invitacion", { data: { ok: false, motivo } });

    expect(await canjearCodigoInvitacion("UVA-2026")).toEqual({ error: mensaje });
    expect(servidorFalso.argumentosDe("rpc:registrar_canje_fallido")).toEqual({
      p_usuario_id: ESTUDIANTE.id,
    });
    expect(servidorFalso.llamadasA("rpc:limpiar_intentos_canjear_codigo")).toHaveLength(0);
    expect(servidorFalso.revalidaciones).toEqual([]);
    expect(enviarCorreoBienvenida).not.toHaveBeenCalled();
  });

  it("un motivo que la acción no conoce cae en un mensaje genérico, no en undefined", async () => {
    servidorFalso.responder("rpc:canjear_codigo_invitacion", { data: { ok: false, motivo: "nuevo_motivo" } });

    expect(await canjearCodigoInvitacion("UVA-2026")).toEqual({ error: "No pudimos canjear el código." });
  });

  it("un error de la RPC también cuenta como intento fallido", async () => {
    // Si no contara, forzar errores sería una forma de probar códigos sin límite.
    servidorFalso.responder("rpc:canjear_codigo_invitacion", { data: null, error: { message: "boom" } });

    const resultado = await canjearCodigoInvitacion("UVA-2026");

    expect(resultado.error).toMatch(/No pudimos procesar/);
    expect(servidorFalso.llamadasA("rpc:registrar_canje_fallido")).toHaveLength(1);
  });
});

describe("canje exitoso", () => {
  beforeEach(() => {
    servidorFalso.conUsuario(ESTUDIANTE);
    limitePermitido();
    servidorFalso.responder("rpc:canjear_codigo_invitacion", { data: { ok: true, motivo: null } });
    servidorFalso.responder("from:perfiles", { data: { nombre: "Ana", correo: "ana@uva.co" } });
  });

  it("limpia los intentos, revalida el dashboard y manda la bienvenida", async () => {
    expect(await canjearCodigoInvitacion("  UVA-2026  ")).toEqual({ success: true });

    expect(servidorFalso.operaciones()).toEqual([
      "auth:getUser",
      "rpc:verificar_limite_canjear_codigo",
      "rpc:canjear_codigo_invitacion",
      "rpc:limpiar_intentos_canjear_codigo",
      "from:perfiles",
    ]);
    expect(servidorFalso.argumentosDe("rpc:canjear_codigo_invitacion")).toMatchObject({ p_codigo: "UVA-2026" });
    expect(servidorFalso.llamadasA("rpc:registrar_canje_fallido")).toHaveLength(0);
    expect(servidorFalso.revalidaciones).toEqual(["/dashboard"]);
    expect(enviarCorreoBienvenida).toHaveBeenCalledWith("ana@uva.co", "Ana", "http://localhost:3000/dashboard");
  });

  it("el perfil se lee con el cliente de la sesión (RLS), no con Service Role", async () => {
    await canjearCodigoInvitacion("UVA-2026");

    const [lectura] = servidorFalso.llamadasA("from:perfiles");
    expect(lectura.cliente).toBe("sesion");
    expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([["id", ESTUDIANTE.id]]);
  });

  it("si Resend falla, el canje sigue siendo un éxito y el fallo queda registrado", async () => {
    vi.mocked(enviarCorreoBienvenida).mockResolvedValue({ success: false, error: "Resend caído" });

    expect(await canjearCodigoInvitacion("UVA-2026")).toEqual({ success: true });
    expect(logError).toHaveBeenCalledWith(
      "canjearCodigoInvitacion",
      "enviarCorreoBienvenida falló",
      expect.any(Error),
      { area: "email" },
    );
    expect(servidorFalso.revalidaciones).toEqual(["/dashboard"]);
  });

  it("sin perfil legible, no intenta mandar el correo pero el canje se mantiene", async () => {
    servidorFalso.responder("from:perfiles", { data: null });

    expect(await canjearCodigoInvitacion("UVA-2026")).toEqual({ success: true });
    expect(enviarCorreoBienvenida).not.toHaveBeenCalled();
  });
});
