import { describe, expect, it } from "vitest";
import {
  MAX_CARACTERES_INTRODUCCION,
  MAX_PREGUNTAS,
  contarPalabras,
  leerPreguntas,
  parrafos,
  validarContenidoEscuela,
} from "@/lib/escuela-contenido";

const P = (pregunta: string, respuesta: string) => ({ pregunta, respuesta });

describe("parrafos", () => {
  it("separa por líneas en blanco y une los saltos simples", () => {
    expect(parrafos("Uno\nsigue\n\n  Dos  \r\n\r\nTres")).toEqual(["Uno sigue", "Dos", "Tres"]);
  });
  it("sin texto no hay párrafos", () => {
    expect(parrafos(null)).toEqual([]);
    expect(parrafos("  \n\n ")).toEqual([]);
  });
});

describe("contarPalabras", () => {
  it("cuenta palabras con espacios y saltos de línea", () => {
    expect(contarPalabras("  Cursos de\n\nobra civil ")).toBe(4);
    expect(contarPalabras("")).toBe(0);
  });
});

describe("leerPreguntas (lo que viene de la base)", () => {
  it("descarta lo que no tiene la forma esperada sin romper", () => {
    expect(leerPreguntas(null)).toEqual([]);
    expect(leerPreguntas({ pregunta: "x" })).toEqual([]);
    expect(leerPreguntas([P("¿A?", "B"), { pregunta: 1 }, P(" ", "x"), "texto"])).toEqual([P("¿A?", "B")]);
  });
  it(`nunca devuelve más de ${MAX_PREGUNTAS}`, () => {
    expect(leerPreguntas(Array.from({ length: 8 }, (_, i) => P(`¿${i}?`, "r")))).toHaveLength(MAX_PREGUNTAS);
  });
});

describe("validarContenidoEscuela", () => {
  it("normaliza y guarda null sin introducción", () => {
    expect(validarContenidoEscuela({ introduccion: "  ", preguntas: [] })).toEqual({
      ok: true,
      valor: { introduccion: null, preguntas: [] },
    });
  });

  it("descarta las filas totalmente vacías del editor", () => {
    const r = validarContenidoEscuela({ introduccion: "Texto", preguntas: [P("", ""), P(" ¿A? ", " B ")] });
    expect(r).toEqual({ ok: true, valor: { introduccion: "Texto", preguntas: [P("¿A?", "B")] } });
  });

  it("una pregunta sin respuesta (o al revés) es un error, no se pierde en silencio", () => {
    expect(validarContenidoEscuela({ introduccion: "", preguntas: [P("¿A?", "")] })).toEqual({
      ok: false,
      error: "A la pregunta 1 le falta la respuesta.",
    });
    expect(validarContenidoEscuela({ introduccion: "", preguntas: [P("", "B")] })).toEqual({
      ok: false,
      error: "A la pregunta 1 le falta la pregunta.",
    });
  });

  it("rechaza más preguntas o textos más largos de lo permitido", () => {
    const seis = Array.from({ length: MAX_PREGUNTAS + 1 }, (_, i) => P(`¿${i}?`, "r"));
    expect(validarContenidoEscuela({ introduccion: "", preguntas: seis }).ok).toBe(false);
    expect(validarContenidoEscuela({ introduccion: "a".repeat(MAX_CARACTERES_INTRODUCCION + 1), preguntas: [] }).ok).toBe(false);
  });
});
