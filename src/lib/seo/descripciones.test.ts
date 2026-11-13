import { describe, expect, it } from "vitest";
import {
  DESCRIPCION_MAXIMA,
  DESCRIPCION_META_CATALOGO,
  DESCRIPCION_META_PORTADA,
  DESCRIPCION_META_SOPORTE,
  DESCRIPCION_MINIMA,
  descripcionEscuela,
  recortarDescripcion,
} from "@/lib/seo/descripciones";
import { DESCRIPCION_SITIO } from "@/lib/seo/metadata";

describe("descripciones fijas", () => {
  it.each([
    ["portada", DESCRIPCION_META_PORTADA],
    ["catálogo", DESCRIPCION_META_CATALOGO],
    ["soporte", DESCRIPCION_META_SOPORTE],
    ["sitio", DESCRIPCION_SITIO],
  ])("%s mide entre 140 y 155 caracteres", (_, texto) => {
    expect(texto.length).toBeGreaterThanOrEqual(DESCRIPCION_MINIMA);
    expect(texto.length).toBeLessThanOrEqual(DESCRIPCION_MAXIMA);
  });

  it("son distintas entre sí", () => {
    const todas = [DESCRIPCION_META_PORTADA, DESCRIPCION_META_CATALOGO, DESCRIPCION_META_SOPORTE, DESCRIPCION_SITIO];
    expect(new Set(todas).size).toBe(todas.length);
  });

  it("soporte no promete pagos (hoy el acceso es por invitación)", () => {
    expect(DESCRIPCION_META_SOPORTE.toLowerCase()).not.toContain("pago");
  });
});

describe("descripcionEscuela", () => {
  it.each(["BIM", "Estructuras y Construcción", "Presupuestos y costos de obra"])(
    "«%s» nunca pasa de 155 caracteres",
    (nombre) => {
      expect(descripcionEscuela(nombre).length).toBeLessThanOrEqual(DESCRIPCION_MAXIMA);
      expect(descripcionEscuela(nombre)).toContain(nombre);
    },
  );
});

describe("recortarDescripcion", () => {
  it("deja igual un texto corto, sin espacios de sobra", () => {
    expect(recortarDescripcion("  Curso   de Revit. ")).toBe("Curso de Revit.");
  });

  it("corta en un límite de palabra, sin pasar de 155 y con «…»", () => {
    const largo = "Aprende a modelar ".repeat(20);
    const recortado = recortarDescripcion(largo);
    expect(recortado.length).toBeLessThanOrEqual(DESCRIPCION_MAXIMA);
    expect(recortado.endsWith("…")).toBe(true);
    expect(largo).toContain(recortado.slice(0, -1));
    expect(recortado.slice(0, -1).endsWith(" ")).toBe(false);
  });

  it("no deja una coma o un punto antes de los puntos suspensivos", () => {
    const texto = `${"palabra ".repeat(18)}fin, ${"otra ".repeat(20)}`;
    expect(recortarDescripcion(texto)).not.toMatch(/[,.]…$/);
  });
});
