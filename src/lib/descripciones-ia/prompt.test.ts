import { describe, expect, it } from "vitest";
import {
  PRIMERA_FRASE_MAXIMO,
  mensajeDescripcionCurso,
  systemPromptDescripcionCurso,
} from "@/lib/descripciones-ia/prompt";
import { DESCRIPCION_MAXIMA } from "@/lib/seo/descripciones";

const LECCIONES = [{ modulo: "Módulo 1", titulo: "Qué es un APU", material: "Análisis de precios unitarios." }];

describe("descripción de curso con IA", () => {
  it("la primera frase cabe en lo que muestra Google (recortarDescripcion)", () => {
    expect(PRIMERA_FRASE_MAXIMO).toBeLessThanOrEqual(DESCRIPCION_MAXIMA);
    expect(systemPromptDescripcionCurso()).toContain(`${PRIMERA_FRASE_MAXIMO} caracteres`);
  });

  it("le pasa al modelo la escuela del curso", () => {
    const mensaje = mensajeDescripcionCurso({
      tituloCurso: "Presupuesto de obra",
      nivel: "Básico",
      escuelas: ["Presupuestos y costos"],
      lecciones: LECCIONES,
    });
    expect(mensaje).toContain("Escuela: Presupuestos y costos");
  });

  it("sin escuela no deja una línea vacía de escuela", () => {
    const mensaje = mensajeDescripcionCurso({
      tituloCurso: "Presupuesto de obra",
      nivel: "Básico",
      escuelas: [],
      lecciones: LECCIONES,
    });
    expect(mensaje).not.toContain("Escuela:");
  });

  it("usa el vocabulario de UVA (en línea, no online)", () => {
    expect(systemPromptDescripcionCurso()).not.toMatch(/escuela online/);
  });
});
