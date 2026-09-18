import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { login } from "@/actions/auth/login";
import { registro } from "@/actions/auth/registro";
import { confirmarEnlace } from "@/actions/auth/confirmar-enlace";
import { GET as callbackOAuth } from "@/app/auth/callback/route";

/**
 * Open redirect en los cuatro puntos que reciben un destino del usuario.
 * AUDIT-2026-09-15.md — P2-8 (hallazgo encontrado al planearlo).
 *
 * `lib/redirect-seguro.test.ts` prueba la función con todas las variantes
 * hostiles. Esto prueba otra cosa: que CADA punto de entrada la use. Un
 * helper perfecto que alguien deja de llamar no protege nada, y así era como
 * estaba `/auth/callback`, que ni siquiera tenía el `startsWith("/")`.
 */

const HOSTILES = ["//evil.example", "//evil.example/login", "/\t/evil.example", "https://evil.example"];

/** Ejecuta y devuelve el destino del `redirect()`; falla si no redirigió. */
async function destinoDe(accion: () => Promise<unknown>): Promise<string> {
  try {
    await accion();
  } catch (error) {
    if (error instanceof RedireccionFalsa) return error.destino;
    throw error;
  }
  throw new Error("La acción no llamó a redirect()");
}

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

beforeEach(() => {
  servidorFalso.reiniciar();
});

describe("login", () => {
  beforeEach(() => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: true, segundos_espera: 0 } });
    servidorFalso.responder("auth:signInWithPassword", { data: { user: { id: "u-1" } }, error: null });
    servidorFalso.responder("from:perfiles", { data: { estado: "ACTIVO" } });
  });

  const entrar = (redirect: string) =>
    destinoDe(() => login(null, formulario({ email: "ana@uva.co", password: "x", redirect })));

  it.each(HOSTILES)("tras un login válido, %j no saca del sitio", async (hostil) => {
    expect(await entrar(hostil)).toBe("/dashboard");
  });

  it("conserva un destino interno legítimo", async () => {
    expect(await entrar("/cursos/revit-basico")).toBe("/cursos/revit-basico");
  });

  it("el servidor falso registra el recorrido real de la acción", async () => {
    // Control positivo: si el doble no registrara, las pruebas de arriba
    // pasarían igual sin haber ejecutado la lógica.
    await entrar("/dashboard");
    expect(servidorFalso.operaciones()).toEqual([
      "rpc:verificar_intentos_login",
      "auth:signInWithPassword",
      "from:perfiles",
      "rpc:limpiar_intentos_login",
    ]);
  });
});

describe("registro", () => {
  beforeEach(() => {
    servidorFalso.responder("rpc:verificar_limite_check_email", { data: { permitido: true } });
    servidorFalso.responder("rpc:check_email_provider", {
      data: [{ account_exists: false, provider: null }],
    });
    // Con `session` el proyecto no exige confirmar el correo y la acción
    // redirige de inmediato: es la rama que usa el destino.
    servidorFalso.responder("auth:signUp", { data: { user: { id: "u-2" }, session: {} }, error: null });
  });

  it.each(HOSTILES)("tras crear la cuenta, %j no saca del sitio", async (hostil) => {
    const destino = await destinoDe(() =>
      registro(
        null,
        formulario({ email: "ana@uva.co", nombre: "Ana", password: "Segura12345!x", redirect: hostil }),
      ),
    );
    expect(destino).toBe("/dashboard");
  });
});

describe("confirmarEnlace", () => {
  it("una ruta con `//` tras el dominio no se convierte en otro host", async () => {
    // `https://x//evil.example` tiene pathname `//evil.example`: quedarse
    // con pathname + search (lo que hacía antes) no bastaba.
    const destino = await destinoDe(() =>
      confirmarEnlace(formulario({ code: "codigo", next: "https://uva.edu.co//evil.example" })),
    );
    expect(destino).toBe("/dashboard");
  });

  it("conserva el destino interno que arma el webhook de correo", async () => {
    const destino = await destinoDe(() =>
      confirmarEnlace(formulario({ code: "codigo", next: "http://localhost:3000/actualizar-password" })),
    );
    expect(destino).toBe("/actualizar-password");
  });
});

describe("/auth/callback (OAuth con Google)", () => {
  const llamar = (next: string) =>
    destinoDe(() =>
      callbackOAuth(
        new Request(
          `http://localhost:3000/auth/callback?code=codigo&next=${encodeURIComponent(next)}`,
        ) as unknown as NextRequest,
      ),
    );

  it.each(HOSTILES)("tras un intercambio de código válido, %j no saca del sitio", async (hostil) => {
    expect(await llamar(hostil)).toBe("/dashboard");
  });

  it("conserva un destino interno legítimo", async () => {
    expect(await llamar("/cursos/revit-basico")).toBe("/cursos/revit-basico");
  });
});
