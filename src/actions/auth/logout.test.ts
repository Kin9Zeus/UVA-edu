import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { logout, logoutEnTodos } from "@/actions/auth/logout";
import { logError } from "@/lib/log";

/**
 * Cerrar sesión — FASE 8.3 del plan de blindaje. `signOut()` sin argumento es
 * global: "Cerrar sesión" sacaba al usuario de todos sus dispositivos aunque
 * Mi perfil dijera "en este dispositivo". Ahora son dos acciones distintas.
 */

async function destinoDe(accion: Promise<unknown>): Promise<string> {
  try {
    await accion;
  } catch (error) {
    if (error instanceof RedireccionFalsa) return error.destino;
    throw error;
  }
  throw new Error("la acción no redirigió");
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario({ id: "estudiante-1", email: "ana@uva.co" });
  vi.mocked(logError).mockClear();
});

describe("logout", () => {
  it("cierra solo la sesión de este dispositivo (scope local) y vuelve al inicio", async () => {
    expect(await destinoDe(logout())).toBe("/");

    const cierres = servidorFalso.llamadasA("auth:signOut");
    expect(cierres).toHaveLength(1);
    expect(cierres[0].argumentos[0]).toEqual({ scope: "local" });
  });

  it("si Supabase falla igual redirige, y deja el fallo registrado", async () => {
    servidorFalso.responder("auth:signOut", { data: null, error: { message: "boom" } });

    expect(await destinoDe(logout())).toBe("/");
    expect(logError).toHaveBeenCalledWith("logout", "signOut(local) falló", expect.anything(), { area: "auth" });
  });
});

describe("logoutEnTodos", () => {
  it("cierra la sesión en todos los dispositivos (scope global) y vuelve al inicio", async () => {
    expect(await destinoDe(logoutEnTodos())).toBe("/");

    const cierres = servidorFalso.llamadasA("auth:signOut");
    expect(cierres).toHaveLength(1);
    expect(cierres[0].argumentos[0]).toEqual({ scope: "global" });
  });

  it("si Supabase falla igual redirige, y deja el fallo registrado", async () => {
    servidorFalso.responder("auth:signOut", { data: null, error: { message: "boom" } });

    expect(await destinoDe(logoutEnTodos())).toBe("/");
    expect(logError).toHaveBeenCalledWith("logoutEnTodos", "signOut(global) falló", expect.anything(), { area: "auth" });
  });
});
