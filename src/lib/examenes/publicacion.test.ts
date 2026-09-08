import { describe, expect, it } from "vitest";
import { motivosParaNoPublicarExamen, sePuedePublicarExamen } from "@/lib/examenes/publicacion";

const preguntaOk = { tipo: "OPCION_UNICA" as const, puntos: 1 };

describe("motivosParaNoPublicarExamen", () => {
  it("un examen con título, preguntas de sobra y 75% se puede publicar", () => {
    expect(
      sePuedePublicarExamen({
        titulo: "Examen final",
        notaAprobatoria: 75,
        preguntas: Array.from({ length: 8 }, () => preguntaOk),
      }),
    ).toBe(true);
  });

  it("exige título", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "   ",
      notaAprobatoria: 75,
      preguntas: Array.from({ length: 8 }, () => preguntaOk),
    });
    expect(motivos).toContain("El examen necesita un título.");
  });

  it("exige al menos una pregunta", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      notaAprobatoria: 75,
      preguntas: [],
    });
    expect(motivos).toContain("El examen necesita al menos una pregunta.");
  });

  it("rechaza una nota por debajo del piso de negocio", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      notaAprobatoria: 60,
      preguntas: Array.from({ length: 8 }, () => preguntaOk),
    });
    expect(motivos).toContain("La nota para aprobar no puede bajar de 75%.");
  });

  it("avisa cuando el umbral obliga a acertar todo (3 preguntas al 75%)", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      notaAprobatoria: 75,
      preguntas: [preguntaOk, preguntaOk, preguntaOk],
    });
    expect(motivos.some((motivo) => motivo.includes("acertarlas todas"))).toBe(true);
  });

  it("con 4 preguntas al 75% ya hay margen de un fallo: no avisa", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      notaAprobatoria: 75,
      preguntas: [preguntaOk, preguntaOk, preguntaOk, preguntaOk],
    });
    expect(motivos).toEqual([]);
  });

  it("un examen de una sola pregunta no dispara el aviso de margen (sería redundante)", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "Examen final",
      notaAprobatoria: 100,
      preguntas: [preguntaOk],
    });
    expect(motivos).toEqual([]);
  });

  it("devuelve todos los motivos que fallan, no solo el primero", () => {
    const motivos = motivosParaNoPublicarExamen({
      titulo: "",
      notaAprobatoria: 50,
      preguntas: [],
    });
    expect(motivos).toHaveLength(3);
  });
});
