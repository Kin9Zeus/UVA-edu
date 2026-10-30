import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));

import { quitarSegundoFactorDeAdmin } from "@/actions/admin/segundoFactor";
import { registrarBitacora } from "@/lib/admin/bitacora";

/**
 * Quitar la verificación en dos pasos de otro administrador — FASE 8.1. Es la
 * recuperación cuando alguien pierde el celular, y por lo mismo la acción más
 * peligrosa del bloque: lo que se prueba es a quién NO se le puede hacer.
 */

const ADMIN = { id: "11111111-1111-4111-8111-111111111111", email: "admin@uva.co", aal: "aal2" as const };
const OTRO = "22222222-2222-4222-8222-222222222222";

const FACTOR = (id: string, status = "verified") => ({ id, factor_type: "totp", status });
const borrados = () => servidorFalso.llamadasA("auth.admin.mfa:deleteFactor").map((l) => l.argumentos[0]);

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ADMIN);
  // 1ª lectura: el rol de quien actúa (requireAdmin); 2ª: el de la cuenta objetivo.
  servidorFalso.responderEnOrden("from:perfiles", [
    { data: { rol: "ADMINISTRADOR" }, error: null },
    { data: { rol: "ADMINISTRADOR" }, error: null },
  ]);
  servidorFalso.responder("auth.admin.mfa:listFactors", {
    data: { factors: [FACTOR("f-1"), FACTOR("f-2")] },
    error: null,
  });
  servidorFalso.responder("auth.admin.mfa:deleteFactor", { data: {}, error: null });
  vi.mocked(registrarBitacora).mockReset();
});

describe("quitarSegundoFactorDeAdmin", () => {
  it("quita todos los factores del otro administrador, con la API de administración, y deja bitácora", async () => {
    expect(await quitarSegundoFactorDeAdmin(OTRO)).toEqual({ success: true });

    expect(servidorFalso.llamadasA("auth.admin.mfa:listFactors")[0].argumentos[0]).toEqual({ userId: OTRO });
    expect(borrados()).toEqual([
      { id: "f-1", userId: OTRO },
      { id: "f-2", userId: OTRO },
    ]);
    expect(registrarBitacora).toHaveBeenCalledWith(expect.anything(), {
      idAdmin: ADMIN.id,
      accion: "Quitó la verificación en dos pasos de otro administrador",
      entidadAfectada: "perfiles",
      idEntidadAfectada: OTRO,
      detalles: "2 dispositivo(s) quitados",
    });
    expect(servidorFalso.revalidaciones).toEqual(["/admin/usuarios"]);
  });

  it("NO sobre sí mismo: la propia se cambia en Mi perfil, donde no se puede quedar sin ninguna", async () => {
    expect(await quitarSegundoFactorDeAdmin(ADMIN.id)).toEqual({ error: "Tu propia verificación se cambia en Mi perfil." });
    expect(borrados()).toEqual([]);
  });

  it("NO desde una sesión aal1: con solo la contraseña de un admin no se desarma el 2FA de otro", async () => {
    servidorFalso.conUsuario({ ...ADMIN, aal: "aal1" });

    expect((await quitarSegundoFactorDeAdmin(OTRO)).error).toMatch(/verificación en dos pasos/);
    expect(borrados()).toEqual([]);
    expect(registrarBitacora).not.toHaveBeenCalled();
  });

  it("NO lo hace un estudiante", async () => {
    servidorFalso.responderEnOrden("from:perfiles", [{ data: { rol: "ESTUDIANTE" }, error: null }]);

    expect(await quitarSegundoFactorDeAdmin(OTRO)).toEqual({ error: "No tienes permisos de administrador." });
    expect(borrados()).toEqual([]);
  });

  it("solo sobre cuentas de administrador", async () => {
    servidorFalso.responderEnOrden("from:perfiles", [
      { data: { rol: "ADMINISTRADOR" }, error: null },
      { data: { rol: "ESTUDIANTE" }, error: null },
    ]);

    expect(await quitarSegundoFactorDeAdmin(OTRO)).toEqual({
      error: "Solo los administradores tienen verificación en dos pasos.",
    });
    expect(borrados()).toEqual([]);
  });

  it("un id mal formado no llega a Supabase", async () => {
    expect(await quitarSegundoFactorDeAdmin("no-es-un-id")).toEqual({ error: "Usuario no válido." });
    expect(servidorFalso.llamadasA("auth.admin.mfa:listFactors")).toHaveLength(0);
  });

  it("sin factores lo dice, sin dejar una bitácora de algo que no pasó", async () => {
    servidorFalso.responder("auth.admin.mfa:listFactors", { data: { factors: [] }, error: null });

    expect(await quitarSegundoFactorDeAdmin(OTRO)).toEqual({ error: "Esta cuenta no tiene la verificación activada." });
    expect(registrarBitacora).not.toHaveBeenCalled();
  });

  it("si un borrado falla, no anuncia éxito ni deja bitácora de algo a medias", async () => {
    servidorFalso.responderEnOrden("auth.admin.mfa:deleteFactor", [
      { data: {}, error: null },
      { data: null, error: { message: "boom", code: "unexpected_failure" } },
    ]);

    expect(await quitarSegundoFactorDeAdmin(OTRO)).toEqual({
      error: "No pudimos quitar toda la verificación. Vuelve a intentarlo.",
    });
    expect(registrarBitacora).not.toHaveBeenCalled();
  });
});
