import { describe, expect, it, vi } from "vitest";
import { repartirPorVideo } from "./generar";
import { validarPreguntasGeneradas } from "./validar";
import type { GeneratedQuestion, VideoConTranscripcion } from "./tipos";

// logError reporta a Sentry y escribe en consola; en los tests solo estorba.
vi.mock("@/lib/log", () => ({ logError: vi.fn(() => "evento-falso") }));

const VIDEOS: VideoConTranscripcion[] = [
  { videoId: "v1", title: "Iluminación", transcript: "la subdivisión de la luz controla el ruido" },
  { videoId: "v2", title: "Cámara", transcript: "la cámara física usa ISO y obturador" },
];

function pregunta(videoId: string, sourceFragment: string): GeneratedQuestion {
  return {
    videoId,
    question: "¿?",
    options: ["a", "b", "c", "d"],
    correctAnswerIndex: 0,
    sourceFragment,
  };
}

describe("repartirPorVideo", () => {
  it("reparte las preguntas en el orden del temario", () => {
    const { aceptadas, faltantesPorVideo, huerfanas } = repartirPorVideo(
      [pregunta("v2", "ISO"), pregunta("v1", "la luz")],
      VIDEOS,
      1,
    );

    expect(aceptadas.map((p) => p.videoId)).toEqual(["v1", "v2"]);
    expect(faltantesPorVideo).toEqual([]);
    expect(huerfanas).toEqual([]);
  });

  it("recorta cuando el modelo devuelve de más", () => {
    const { aceptadas } = repartirPorVideo(
      [pregunta("v1", "a"), pregunta("v1", "b"), pregunta("v1", "c")],
      [VIDEOS[0]],
      2,
    );
    expect(aceptadas).toHaveLength(2);
  });

  // "loguearlo pero no fallar todo el proceso": las preguntas del video que sí
  // salió bien tienen que sobrevivir.
  it("reporta el video corto sin descartar el resto", () => {
    const { aceptadas, faltantesPorVideo } = repartirPorVideo(
      [pregunta("v1", "a"), pregunta("v1", "b")],
      VIDEOS,
      2,
    );

    expect(aceptadas).toHaveLength(2);
    expect(faltantesPorVideo).toEqual([{ videoId: "v2", title: "Cámara", recibidas: 0 }]);
  });

  // Un video con CERO preguntas no existe como clave del Map interno; es
  // justo el caso que más importa reportar.
  it("incluye un video con cero preguntas entre los faltantes", () => {
    const { faltantesPorVideo } = repartirPorVideo([], VIDEOS, 1);
    expect(faltantesPorVideo.map((v) => v.videoId)).toEqual(["v1", "v2"]);
  });

  it("aparta las preguntas con un videoId que no se envió", () => {
    const { aceptadas, huerfanas } = repartirPorVideo(
      [pregunta("v1", "a"), pregunta("inventado", "b")],
      VIDEOS,
      1,
    );

    expect(aceptadas).toHaveLength(1);
    expect(huerfanas).toHaveLength(1);
  });
});

describe("validarPreguntasGeneradas", () => {
  it("guarda solo las preguntas cuyo fragmento está en su propio video", () => {
    const { validadas, descartadas } = validarPreguntasGeneradas(
      [pregunta("v1", "controla el ruido"), pregunta("v2", "ISO y obturador")],
      VIDEOS,
      "curso-1",
    );

    expect(validadas).toHaveLength(2);
    expect(descartadas).toBe(0);
  });

  /**
   * El bug que esta función existe para impedir: una pregunta del video 1 que
   * cita una frase del video 2. Contra las transcripciones concatenadas
   * validaría; contra la de su propio video, no.
   */
  it("descarta una pregunta anclada al video equivocado", () => {
    const { validadas, descartadas } = validarPreguntasGeneradas(
      [pregunta("v1", "ISO y obturador")],
      VIDEOS,
      "curso-1",
    );

    expect(validadas).toHaveLength(0);
    expect(descartadas).toBe(1);
  });

  it("nombra los videos que quedaron sin ninguna pregunta validada", () => {
    const { videosSinPreguntas } = validarPreguntasGeneradas(
      [pregunta("v1", "controla el ruido"), pregunta("v2", "esto no lo dijo nadie")],
      VIDEOS,
      "curso-1",
    );

    expect(videosSinPreguntas).toEqual([{ videoId: "v2", title: "Cámara" }]);
  });

  it("conserva el título del video en la pregunta validada", () => {
    const { validadas } = validarPreguntasGeneradas(
      [pregunta("v1", "controla el ruido")],
      VIDEOS,
      "curso-1",
    );
    expect(validadas[0].title).toBe("Iluminación");
  });
});
