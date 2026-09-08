import { describe, expect, it } from "vitest";
import { construirRevision } from "@/lib/examenes/revision";
import type { PreguntaCongelada } from "@/lib/examenes/tipos";

const enunciado = { type: "doc" as const, content: [] };

function opciones(...marcas: boolean[]) {
  return marcas.map((correcta, i) => ({ id: `o${i + 1}`, texto: `Opción ${i + 1}`, correcta }));
}

describe("construirRevision", () => {
  it("marca cuál opción eligió el estudiante y cuál era la correcta", () => {
    const preguntas: PreguntaCongelada[] = [
      {
        id: "p1",
        tipo: "OPCION_UNICA",
        enunciado,
        puntos: 1,
        opciones: opciones(true, false),
        respuestasAceptadas: [],
      },
    ];
    const [revision] = construirRevision(preguntas, { p1: "o2" });

    expect(revision.acertada).toBe(false);
    expect(revision.opciones).toEqual([
      { id: "o1", texto: "Opción 1", correcta: true, marcadaPorEstudiante: false },
      { id: "o2", texto: "Opción 2", correcta: false, marcadaPorEstudiante: true },
    ]);
  });

  it("una pregunta sin responder no marca ninguna opción", () => {
    const preguntas: PreguntaCongelada[] = [
      {
        id: "p1",
        tipo: "OPCION_MULTIPLE",
        enunciado,
        puntos: 1,
        opciones: opciones(true, true, false),
        respuestasAceptadas: [],
      },
    ];
    const [revision] = construirRevision(preguntas, {});

    expect(revision.acertada).toBe(false);
    expect(revision.opciones?.every((opcion) => !opcion.marcadaPorEstudiante)).toBe(true);
  });

  it("respuesta corta: expone lo que escribió y las respuestas aceptadas", () => {
    const preguntas: PreguntaCongelada[] = [
      {
        id: "p1",
        tipo: "RELLENAR_ESPACIO",
        enunciado,
        puntos: 1,
        opciones: null,
        respuestasAceptadas: ["V-Ray", "Chaos V-Ray"],
      },
    ];
    const [revision] = construirRevision(preguntas, { p1: "vray" });

    expect(revision.acertada).toBe(true);
    expect(revision.respuestaTexto).toBe("vray");
    expect(revision.respuestasAceptadas).toEqual(["V-Ray", "Chaos V-Ray"]);
    expect(revision.opciones).toBeNull();
  });

  it("respuesta corta sin responder: respuestaTexto queda null, no string vacío", () => {
    const preguntas: PreguntaCongelada[] = [
      {
        id: "p1",
        tipo: "RELLENAR_ESPACIO",
        enunciado,
        puntos: 1,
        opciones: null,
        respuestasAceptadas: ["vray"],
      },
    ];
    const [sinResponder] = construirRevision(preguntas, {});
    const [espacios] = construirRevision(preguntas, { p1: "   " });

    expect(sinResponder.respuestaTexto).toBeNull();
    expect(espacios.respuestaTexto).toBeNull();
  });

  it("conserva el orden y la longitud de las preguntas congeladas", () => {
    const preguntas: PreguntaCongelada[] = [
      { id: "a", tipo: "OPCION_UNICA", enunciado, puntos: 1, opciones: opciones(true, false), respuestasAceptadas: [] },
      { id: "b", tipo: "VERDADERO_FALSO", enunciado, puntos: 1, opciones: opciones(false, true), respuestasAceptadas: [] },
    ];
    const revision = construirRevision(preguntas, { a: "o1", b: "o2" });

    expect(revision.map((r) => r.id)).toEqual(["a", "b"]);
    expect(revision.every((r) => r.acertada)).toBe(true);
  });
});
