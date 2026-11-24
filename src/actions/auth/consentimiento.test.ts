import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/actions/auth/check-email", () => ({ checkEmail: vi.fn(async () => ({ exists: false })) }));

import { registro } from "@/actions/auth/registro";
import { GET as callbackOAuth } from "@/app/auth/callback/route";
import { CASILLAS_LEGALES, MENSAJE_FALTAN_CASILLAS } from "@/lib/legal/consentimiento";
import { logError } from "@/lib/log";

/**
 * P1-5 (AUDIT-2026-11-23): la prueba del consentimiento. La fila la escribe
 * la base (supabase/sql/140, cubierto en scripts/rls-test.ts); aquí se prueba
 * que la app solo la pide cuando la persona aceptó.
 */

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

const CUENTA = { email: "ana@uva.co", nombre: "Ana", password: "Arquitecta2026!" };
const TODAS = Object.fromEntries(CASILLAS_LEGALES.map((casilla) => [casilla, "on"]));

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
  servidorFalso.responder("auth:signUp", { data: { user: { id: "u-1" }, session: null }, error: null });
});

describe("registro con correo", () => {
  it.each(CASILLAS_LEGALES)("sin la casilla %s no crea la cuenta", async (falta) => {
    const casillas = Object.fromEntries(CASILLAS_LEGALES.filter((c) => c !== falta).map((c) => [c, "on"]));

    expect(await registro(null, formulario({ ...CUENTA, ...casillas }))).toEqual({ error: MENSAJE_FALTAN_CASILLAS });
    expect(servidorFalso.llamadasA("auth:signUp")).toHaveLength(0);
  });

  it("con las tres casillas le pide a la base guardar la prueba", async () => {
    expect(await registro(null, formulario({ ...CUENTA, ...TODAS }))).toEqual({
      needsConfirmation: true,
      email: CUENTA.email,
    });
    expect(servidorFalso.argumentosDe("auth:signUp")).toMatchObject({
      options: { data: { nombre: "Ana", acepta_legal: true } },
    });
  });
});

describe("/auth/callback con Google", () => {
  const ahora = new Date().toISOString();
  const usuarioGoogle = (creado: string) => ({
    id: "u-g",
    app_metadata: { provider: "google" },
    created_at: creado,
    last_sign_in_at: ahora,
  });

  async function entrar() {
    try {
      await callbackOAuth(new Request("http://localhost:3000/auth/callback?code=c") as unknown as NextRequest);
    } catch (error) {
      if (error instanceof RedireccionFalsa) return error.destino;
      throw error;
    }
    throw new Error("no redirigió");
  }

  it("cuenta nueva: guarda el consentimiento del aviso", async () => {
    servidorFalso.responder("auth:exchangeCodeForSession", { data: { user: usuarioGoogle(ahora) }, error: null });
    servidorFalso.responder("rpc:registrar_consentimientos_google", { data: null, error: null });

    expect(await entrar()).toBe("/dashboard");
    expect(servidorFalso.llamadasA("rpc:registrar_consentimientos_google")).toHaveLength(1);
  });

  it("cuenta que ya existía: no lo vuelve a pedir", async () => {
    servidorFalso.responder("auth:exchangeCodeForSession", {
      data: { user: usuarioGoogle("2026-01-01T00:00:00Z") },
      error: null,
    });

    expect(await entrar()).toBe("/dashboard");
    expect(servidorFalso.llamadasA("rpc:registrar_consentimientos_google")).toHaveLength(0);
  });

  it("si la base falla, la persona entra igual y queda registrado", async () => {
    servidorFalso.responder("auth:exchangeCodeForSession", { data: { user: usuarioGoogle(ahora) }, error: null });
    servidorFalso.responder("rpc:registrar_consentimientos_google", { data: null, error: { message: "caída" } });

    expect(await entrar()).toBe("/dashboard");
    expect(logError).toHaveBeenCalledWith(
      "auth/callback",
      "no se guardó el consentimiento de Google",
      expect.anything(),
      expect.objectContaining({ id_usuario: "u-g" }),
    );
  });
});
