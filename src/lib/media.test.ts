import { describe, expect, it } from "vitest";
import { IMAGEN_PORTADA_PLACEHOLDER, esPortadaReal } from "./media";

describe("esPortadaReal", () => {
  it("acepta URLs http(s) y rutas propias", () => {
    expect(esPortadaReal("https://tmvmth.supabase.co/storage/v1/object/public/portadas/a.webp")).toBe(true);
    expect(esPortadaReal("http://localhost:3000/portada.png")).toBe(true);
    expect(esPortadaReal("/imagenes/portada.png")).toBe(true);
  });

  it("rechaza el placeholder, vacíos y valores que next/image no puede pintar", () => {
    expect(esPortadaReal(IMAGEN_PORTADA_PLACEHOLDER)).toBe(false);
    expect(esPortadaReal(null)).toBe(false);
    expect(esPortadaReal(undefined)).toBe(false);
    expect(esPortadaReal("")).toBe(false);
    expect(esPortadaReal("x")).toBe(false);
    expect(esPortadaReal("portada.png")).toBe(false);
    expect(esPortadaReal("//otro-sitio.com/a.png")).toBe(false);
    expect(esPortadaReal("javascript:alert(1)")).toBe(false);
  });
});
