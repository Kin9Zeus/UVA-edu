import { describe, expect, it } from "vitest";
import { contenidoLeccionSchema } from "@/lib/editor/tipos";
import {
  contenidoLeccionComoDocumento,
  contenidoLeccionGeneradoSchema,
  descripcionCursoGeneradaSchema,
  textoPlanoDeContenido,
} from "./tipos";

const GENERADO = {
  introduccion:
    "En esta clase entenderás cómo se arma la tabla del presupuesto ítem por ítem y por qué importa.",
  queVasAAprender:
    "Verás las columnas que componen un ítem de presupuesto y la diferencia entre costos directos e indirectos.",
  organizacion: "Se analiza la estructura de un presupuesto real de un contrato ejecutado.",
  objetivos: [
    "- Estructurar las columnas de un ítem",
    "2. Diferenciar costos directos de indirectos",
    "Evitar cobrar actividades como global",
  ],
};

describe("contenidoLeccionGeneradoSchema", () => {
  it("quita la viñeta o el número que el modelo antepone a un objetivo", () => {
    const { objetivos } = contenidoLeccionGeneradoSchema.parse(GENERADO);
    expect(objetivos).toEqual([
      "Estructurar las columnas de un ítem",
      "Diferenciar costos directos de indirectos",
      "Evitar cobrar actividades como global",
    ]);
  });

  it("rechaza menos de tres objetivos", () => {
    const resultado = contenidoLeccionGeneradoSchema.safeParse({
      ...GENERADO,
      objetivos: GENERADO.objetivos.slice(0, 2),
    });
    expect(resultado.success).toBe(false);
  });
});

describe("contenidoLeccionComoDocumento", () => {
  it("arma siempre entrada, dos secciones y la lista de objetivos, y se puede guardar", () => {
    const documento = contenidoLeccionComoDocumento(contenidoLeccionGeneradoSchema.parse(GENERADO));

    expect(contenidoLeccionSchema.safeParse(documento).success).toBe(true);
    expect(textoPlanoDeContenido(documento).split("\n")).toEqual([
      GENERADO.introduccion,
      "¿Qué vas a aprender?",
      GENERADO.queVasAAprender,
      "¿Cómo está organizada la sesión?",
      GENERADO.organizacion,
      "Al finalizar esta sesión vas a poder:",
      "Estructurar las columnas de un ítem",
      "Diferenciar costos directos de indirectos",
      "Evitar cobrar actividades como global",
    ]);
  });
});

describe("descripcionCursoGeneradaSchema", () => {
  it("junta los párrafos en uno solo", () => {
    const { descripcion } = descripcionCursoGeneradaSchema.parse({
      descripcion: "Primera frase del curso que resume todo.\n\nSegunda frase con el resultado final.",
    });
    expect(descripcion).toBe(
      "Primera frase del curso que resume todo. Segunda frase con el resultado final.",
    );
  });
});

describe("textoPlanoDeContenido", () => {
  it("devuelve un bloque por línea, incluidos los ítems de una lista", () => {
    const documento = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Uno" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Dos" }] }] },
          ],
        },
      ],
    };
    expect(textoPlanoDeContenido(documento).split("\n")).toEqual(["Intro", "Uno", "Dos"]);
  });

  it("devuelve cadena vacía sin documento", () => {
    expect(textoPlanoDeContenido(null)).toBe("");
  });
});
