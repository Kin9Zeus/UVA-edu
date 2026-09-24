import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { login } from "@/actions/auth/login";

/**
 * Login — P2-6 (AUDIT-2026-09-22.md). El destino de `redirect` ya lo cubre
 * redirect-abierto.test.ts; acá, el límite de intentos y la suspensión.
 */

const CORREO = "ana@uva.co";
const USUARIO = { id: "estudiante-1", email: CORREO };

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

const entrar = (campos: Record<string, string> = {}) =>
  login(null, formulario({ email: CORREO, password: "Secreta123!x", ...campos }));

async function destinoDe(accion: Promise<unknown>): Promise<string> {
  try {
    await accion;
  } catch (error) {
    if (error instanceof RedireccionFalsa) return error.destino;
    throw error;
  }
  throw new Error("La acción no redirigió");
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: true, segundos_espera: 0 } });
  servidorFalso.responder("auth:signInWithPassword", { data: { user: USUARIO }, error: null });
  servidorFalso.responder("from:perfiles", { data: { estado: "ACTIVO" } });
});

describe("login", () => {
  it("sin correo o contraseña no consulta nada", async () => {
    expect(await entrar({ password: "" })).toEqual({ error: "Ingresa tu correo y tu contraseña." });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });

  it("éxito: limpia el contador de intentos y redirige", async () => {
    expect(await destinoDe(entrar())).toBe("/dashboard");
    expect(servidorFalso.argumentosDe("rpc:limpiar_intentos_login")).toEqual({ p_correo: CORREO });
  });

  it("credenciales incorrectas: suma un intento fallido con mensaje genérico (no dice si el correo existe)", async () => {
    servidorFalso.responder("auth:signInWithPassword", { data: {}, error: { message: "Invalid login credentials" } });

    expect(await entrar()).toEqual({ error: "Correo o contraseña incorrectos." });
    expect(servidorFalso.argumentosDe("rpc:registrar_login_fallido")).toEqual({ p_correo: CORREO });
    expect(servidorFalso.llamadasA("rpc:limpiar_intentos_login")).toHaveLength(0);
  });

  it("correo sin verificar: ofrece el reenvío y NO cuenta como intento fallido", async () => {
    servidorFalso.responder("auth:signInWithPassword", {
      data: {},
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    expect(await entrar()).toEqual({ pendingVerification: true });
    expect(servidorFalso.llamadasA("rpc:registrar_login_fallido")).toHaveLength(0);
  });

  it("límite agotado: no prueba la contraseña", async () => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: false, segundos_espera: 600 } });

    expect(await entrar()).toEqual({ error: "Demasiados intentos. Espera 10 minutos e intenta de nuevo." });
    expect(servidorFalso.llamadasA("auth:signInWithPassword")).toHaveLength(0);
  });

  it("si la consulta del límite falla, BLOQUEA: no prueba la contraseña (falla cerrado)", async () => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: null, error: { message: "timeout" } });

    expect((await entrar())?.error).toMatch(/No pudimos verificar tu acceso/);
    expect(servidorFalso.llamadasA("auth:signInWithPassword")).toHaveLength(0);
  });

  it("cuenta SUSPENDIDA: Supabase ya creó la sesión, así que se cierra en el acto y no redirige", async () => {
    servidorFalso.responder("from:perfiles", { data: { estado: "SUSPENDIDO" } });

    expect(await entrar()).toEqual({
      error: "Tu cuenta ha sido suspendida. Contacta al soporte para más información.",
    });
    expect(servidorFalso.llamadasA("auth:signOut")).toHaveLength(1);
    // Tampoco se le "perdonan" los intentos: no llegó a entrar.
    expect(servidorFalso.llamadasA("rpc:limpiar_intentos_login")).toHaveLength(0);
  });

  it("el estado se consulta para el usuario que acaba de autenticarse", async () => {
    await destinoDe(entrar());

    expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([["id", USUARIO.id]]);
  });
});
