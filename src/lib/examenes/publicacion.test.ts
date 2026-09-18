import { describe, expect, it } from "vitest";
import { motivosParaNoPublicarExamen, sePuedePublicarExamen } from "@/lib/examenes/publicacion";

const preguntaOk = { tipo: "OPCION_UNICA" as const, puntos: 1 };

describe("motivosParaNoPublicarExamen", () => {
  it("un examen con título y preguntas se puede publicar", () => {
    expect(
      sePuedePublicarExamen({
        titulo: "Examen final",
        preguntas: Array.from({ length: 8 }, () => preguntaOk),
      }),
    ).toBe(true);
  });

  it("exige título", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "   ",
      preguntas: Array.from({ length: 8 }, () => preguntaOk),
    });
    expect(motivos).toContain("El examen necesita un título.");
  });

  it("exige al menos una pregunta", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      preguntas: [],
    });
    expect(motivos).toContain("El examen necesita al menos una pregunta.");
  });

  it("un examen corto ya no dispara ningún aviso de umbral (no hay nota mínima)", () => {
    // Antes, 3 preguntas al 75% avisaban "tendría que acertarlas todas". Con
    // la regla nueva SIEMPRE hay que acertarlas todas, así que el aviso dejó
    // de significar algo y no debe volver.
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      preguntas: [preguntaOk, preguntaOk, preguntaOk],
    });
    expect(motivos).toEqual([]);
  });

  it("un examen de una sola pregunta se puede publicar", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      preguntas: [preguntaOk],
    });
    expect(motivos).toEqual([]);
  });

  it("rechaza publicar con preguntas marcadas como incompletas (ej. EMPAREJAR sin editar)", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      preguntas: [
        ...Array.from({ length: 3 }, () => preguntaOk),
        { tipo: "EMPAREJAR", puntos: 1, incompleta: true },
      ],
    });
    expect(motivos).toContain("Hay una pregunta sin completar.");
  });

  it("cuenta varias preguntas incompletas, no solo si hay alguna", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      preguntas: [
        ...Array.from({ length: 3 }, () => preguntaOk),
        { tipo: "EMPAREJAR", puntos: 1, incompleta: true },
        { tipo: "EMPAREJAR", puntos: 1, incompleta: true },
      ],
    });
    expect(motivos).toContain("Hay 2 preguntas sin completar.");
  });

  it("devuelve todos los motivos que fallan, no solo el primero", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "",
      preguntas: [],
    });
    expect(motivos).toHaveLength(2);
  });
});
