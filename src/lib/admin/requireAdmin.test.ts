import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { requireAdmin } = await import("@/lib/admin/requireAdmin");

/**
 * `requireAdmin` es el guard de TODA acción de administrador. Falla cerrado
 * siempre; lo que cambia es el mensaje: a un administrador de verdad al que se
 * le cae la base no se le debe decir "No tienes permisos de administrador".
 */

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co" });
});

describe("requireAdmin", () => {
  it("un administrador pasa", async () => {
    servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" }, error: null });

    expect(await requireAdmin()).toMatchObject({ adminId: "u1" });
  });

  it("un estudiante NO pasa: 'No tienes permisos de administrador.'", async () => {
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" }, error: null });

    expect(await requireAdmin()).toEqual({ error: "No tienes permisos de administrador." });
  });

  it("si falla la lectura NO pasa (falla cerrado), pero el mensaje es de reintento y no 'sin permisos'", async () => {
    servidorFalso.responder("from:perfiles", { data: null, error: ERROR_PG });

    expect(await requireAdmin()).toEqual({ error: "No pudimos comprobar tus permisos. Intenta de nuevo." });
  });

  it("sin perfil (PGRST116, cero filas) NO pasa y sí es 'sin permisos'", async () => {
    servidorFalso.responder("from:perfiles", { data: null, error: { code: "PGRST116", message: "0 rows" } });

    expect(await requireAdmin()).toEqual({ error: "No tienes permisos de administrador." });
  });

  describe("2FA de administradores (fase 8.1)", () => {
    const SIN_SEGUNDO_FACTOR = {
      error: "Tu sesión no tiene la verificación en dos pasos. Inicia sesión de nuevo y escribe el código de tu app.",
    };

    it("un administrador con sesión aal1 (solo contraseña) NO pasa, y no recibe el cliente de Supabase", async () => {
      servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co", aal: "aal1" });
      servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" }, error: null });

      const resultado = await requireAdmin();

      expect(resultado).toEqual(SIN_SEGUNDO_FACTOR);
      expect(resultado).not.toHaveProperty("supabase");
    });

    it("un administrador con sesión aal2 pasa", async () => {
      servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co", aal: "aal2" });
      servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" }, error: null });

      expect(await requireAdmin()).toMatchObject({ adminId: "u1" });
    });

    it("un estudiante en aal1 recibe 'sin permisos', no el aviso del segundo factor", async () => {
      servidorFalso.conUsuario({ id: "u2", email: "ana@uva.co", aal: "aal1" });
      servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" }, error: null });

      expect(await requireAdmin()).toEqual({ error: "No tienes permisos de administrador." });
    });

    it("si falla la lectura del perfil sigue siendo el mensaje de reintento, aunque la sesión sea aal1", async () => {
      servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co", aal: "aal1" });
      servidorFalso.responder("from:perfiles", { data: null, error: ERROR_PG });

      expect(await requireAdmin()).toEqual({ error: "No pudimos comprobar tus permisos. Intenta de nuevo." });
    });
  });

  it("sin sesión no consulta nada", async () => {
    servidorFalso.conUsuario(null);

    expect(await requireAdmin()).toEqual({ error: "Tu sesión expiró. Vuelve a iniciar sesión." });
    expect(servidorFalso.llamadasA("from:perfiles")).toHaveLength(0);
  });
});
