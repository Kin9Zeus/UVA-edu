import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "u-1", aal: "aal1" } }, error: null }),
      signOut,
    },
  }),
}));
vi.mock("@/lib/supabase/guardia-sesion", () => ({
  getGuardiaSesion: async () => ({ correoVerificado: true, suspendido: false }),
}));

import { updateSession } from "@/lib/supabase/proxy";
import { COOKIE_RECUPERACION } from "@/lib/auth/recuperacion";

/**
 * La sesión del enlace de «recuperar contraseña» en el proxy real: tocar el
 * logo la cierra; la precarga del logo no.
 */
const peticion = (ruta: string, cabeceras: Record<string, string> = {}) =>
  new NextRequest(`https://beta.uvarq.com${ruta}`, {
    headers: { cookie: `${COOKIE_RECUPERACION}=1`, ...cabeceras },
  });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  signOut.mockReset();
});

describe("updateSession con la sesión de recuperar contraseña", () => {
  it("ir al inicio (el logo) cierra la sesión y avisa en el login", async () => {
    const respuesta = await updateSession(peticion("/"));

    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("https://beta.uvarq.com/login?error=recuperacion_sin_cambiar");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(respuesta.cookies.get(COOKIE_RECUPERACION)?.value).toBe("");
  });

  it("la precarga del logo no cierra nada", async () => {
    const respuesta = await updateSession(peticion("/", { "next-router-prefetch": "1" }));

    expect(respuesta.status).toBe(204);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("el formulario de la contraseña sigue abierto", async () => {
    const respuesta = await updateSession(peticion("/actualizar-password"));

    expect(respuesta.status).toBe(200);
    expect(signOut).not.toHaveBeenCalled();
  });
});
