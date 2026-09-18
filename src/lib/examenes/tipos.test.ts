import { describe, expect, it } from "vitest";
import { parsearProgreso, preguntaEntradaSchema } from "@/lib/examenes/tipos";
import type { PreguntaCongelada } from "@/lib/examenes/tipos";

const enunciado = { type: "doc" as const, content: [] };

function entradaEmparejar(pares: { id: string; izquierda: string; derecha: string }[]) {
  return {
    tipo: "EMPAREJAR" as const,
    enunciado,
    puntos: 1,
    opciones: pares,
    respuestasAceptadas: [],
    explicacion: null,
  };
}

describe("preguntaEntradaSchema — EMPAREJAR", () => {
  it("acepta dos o más pares completos", () => {
    const resultado = preguntaEntradaSchema.safeParse(
      entradaEmparejar([
        { id: "p1", izquierda: "Centralizar", derecha: "Proceso claro" },
        { id: "p2", izquierda: "Veracidad", derecha: "Datos actualizados" },
      ]),
    );
    expect(resultado.success).toBe(true);
  });

  it("rechaza menos de dos pares", () => {
    const resultado = preguntaEntradaSchema.safeParse(
      entradaEmparejar([{ id: "p1", izquierda: "A", derecha: "B" }]),
    );
    expect(resultado.success).toBe(false);
  });

  it("rechaza un par con un lado vacío", () => {
    const resultado = preguntaEntradaSchema.safeParse(
      entradaEmparejar([
        { id: "p1", izquierda: "A", derecha: "" },
        { id: "p2", izquierda: "C", derecha: "D" },
      ]),
    );
    expect(resultado.success).toBe(false);
  });

  it("rechaza pares con el mismo id", () => {
    const resultado = preguntaEntradaSchema.safeParse(
      entradaEmparejar([
        { id: "dup", izquierda: "A", derecha: "B" },
        { id: "dup", izquierda: "C", derecha: "D" },
      ]),
    );
    expect(resultado.success).toBe(false);
  });

  it("rechaza dos elementos idénticos en la columna derecha (pregunta ambigua)", () => {
    const resultado = preguntaEntradaSchema.safeParse(
      entradaEmparejar([
        { id: "p1", izquierda: "A", derecha: "Mux" },
        { id: "p2", izquierda: "B", derecha: "mux" },
      ]),
    );
    expect(resultado.success).toBe(false);
  });

  it("rechaza dos elementos idénticos en la columna izquierda", () => {
    const resultado = preguntaEntradaSchema.safeParse(
      entradaEmparejar([
        { id: "p1", izquierda: "Mux", derecha: "A" },
        { id: "p2", izquierda: "Mux", derecha: "B" },
      ]),
    );
    expect(resultado.success).toBe(false);
  });

  it("no confunde la forma de OpcionPregunta (con `correcta`) con la de ParEmparejar", () => {
    // Si alguien mandara opciones de otro tipo por error, el union las
    // rechaza igual: a un ParEmparejar le faltaría "correcta" para colar
    // como OpcionPregunta, y viceversa le faltaría "izquierda"/"derecha".
    const resultado = preguntaEntradaSchema.safeParse({
      ...entradaEmparejar([]),
      opciones: [
        { id: "o1", texto: "Opción 1", correcta: true },
        { id: "o2", texto: "Opción 2", correcta: false },
      ],
    });
    expect(resultado.success).toBe(false);
  });
});

describe("parsearProgreso", () => {
  function congelada(id: string): PreguntaCongelada {
    return {
      id,
      tipo: "OPCION_UNICA",
      enunciado,
      puntos: 1,
      opciones: [{ id: "a", texto: "A", correcta: true }],
      respuestasAceptadas: [],
      paresIzquierda: null,
      paresDerecha: null,
    };
  }

  const preguntas = [congelada("q1"), congelada("q2"), congelada("q3")];

  it("devuelve el progreso tal cual cuando la columna ya tiene la forma nueva", () => {
    const guardado = { resueltas: { q2: "a" }, fallos: 2, cola: ["q3", "q1"] };

    expect(parsearProgreso(guardado, preguntas)).toEqual(guardado);
  });

  it("una columna vacía o de otra forma arranca la cola en el orden congelado", () => {
    const esperado = { resueltas: {}, fallos: 0, cola: ["q1", "q2", "q3"] };

    expect(parsearProgreso(null, preguntas)).toEqual(esperado);
    expect(parsearProgreso({}, preguntas)).toEqual(esperado);
    expect(parsearProgreso("basura", preguntas)).toEqual(esperado);
  });

  it("con resueltas pero sin cola, deja pendientes solo las que faltan", () => {
    expect(parsearProgreso({ resueltas: { q1: "a" }, fallos: 1 }, preguntas)).toEqual({
      resueltas: { q1: "a" },
      fallos: 1,
      cola: ["q2", "q3"],
    });
  });

  it("un contador de fallos inválido no se propaga", () => {
    expect(parsearProgreso({ resueltas: {}, fallos: -3, cola: ["q1"] }, preguntas).fallos).toBe(0);
    expect(parsearProgreso({ resueltas: {}, fallos: "dos", cola: ["q1"] }, preguntas).fallos).toBe(0);
  });
});
