import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

import { proxy } from "@/proxy";

// Fase 2 del plan de blindaje: el cierre del origen en el proxy real, no solo
// en la función que decide (esa se prueba en src/lib/origen.test.ts).
const SECRETO = "s3creto-largo-de-cloudflare-0123456789";

const peticion = (ruta: string, cabeceras: Record<string, string> = {}) =>
  new NextRequest(`https://uva-edu-production.up.railway.app${ruta}`, { headers: cabeceras });

beforeEach(() => {
  updateSession.mockReset();
  updateSession.mockImplementation(async () => NextResponse.next());
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy — cierre del origen", () => {
  it("sin ORIGEN_SECRETO todo sigue como antes", async () => {
    vi.stubEnv("ORIGEN_SECRETO", "");
    const respuesta = await proxy(peticion("/login"));
    expect(respuesta.status).toBe(200);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("con ORIGEN_SECRETO, una petición directa sin la cabecera recibe 403 y no toca la sesión", async () => {
    vi.stubEnv("ORIGEN_SECRETO", SECRETO);
    const respuesta = await proxy(peticion("/login"));
    expect(respuesta.status).toBe(403);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("también el optimizador de imágenes", async () => {
    vi.stubEnv("ORIGEN_SECRETO", SECRETO);
    const respuesta = await proxy(peticion("/_next/image?url=%2Flogo.png&w=64&q=75"));
    expect(respuesta.status).toBe(403);
  });

  it("con la cabecera correcta sigue, y los estáticos no consultan la sesión", async () => {
    vi.stubEnv("ORIGEN_SECRETO", SECRETO);

    expect((await proxy(peticion("/login", { "x-origen-uva": SECRETO }))).status).toBe(200);
    expect(updateSession).toHaveBeenCalledTimes(1);

    expect((await proxy(peticion("/_next/static/chunks/a.js", { "x-origen-uva": SECRETO }))).status).toBe(200);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("/api/health responde sin la cabecera", async () => {
    vi.stubEnv("ORIGEN_SECRETO", SECRETO);
    expect((await proxy(peticion("/api/health"))).status).toBe(200);
  });
});
