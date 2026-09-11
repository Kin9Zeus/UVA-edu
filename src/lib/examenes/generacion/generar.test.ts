import { describe, expect, it, vi } from "vitest";
import { detectarReferenciasAlMaterial, limitarAlTotal } from "./generar";
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

describe("limitarAlTotal", () => {
  it("ordena las preguntas por el orden del temario, no por el de la respuesta", () => {
    const { aceptadas, huerfanas } = limitarAlTotal(
      [pregunta("v2", "ISO"), pregunta("v1", "la luz")],
      VIDEOS,
      2,
    );

    expect(aceptadas.map((p) => p.videoId)).toEqual(["v1", "v2"]);
    expect(huerfanas).toEqual([]);
  });

  it("recorta al total cuando el modelo devuelve de más", () => {
    const { aceptadas } = limitarAlTotal(
      [pregunta("v1", "a"), pregunta("v1", "b"), pregunta("v1", "c")],
      [VIDEOS[0]],
      2,
    );
    expect(aceptadas).toHaveLength(2);
  });

  /**
   * El motivo de recortar por vueltas al temario y no por el orden de llegada.
   * Si el modelo manda 3 preguntas de la lección 1 y 1 de la lección 2, y solo
   * caben 2, lo que tiene que sobrevivir es una de cada — no las dos primeras
   * de la misma clase, que dejarían media mitad del curso sin evaluar.
   */
  it("al recortar sacrifica las repeticiones antes que la cobertura", () => {
    const { aceptadas, leccionesCubiertas } = limitarAlTotal(
      [pregunta("v1", "a"), pregunta("v1", "b"), pregunta("v1", "c"), pregunta("v2", "d")],
      VIDEOS,
      2,
    );

    expect(aceptadas.map((p) => p.videoId)).toEqual(["v1", "v2"]);
    expect(leccionesCubiertas).toBe(2);
  });

  /**
   * El caso que motivó todo el cambio: un curso largo con un examen corto.
   * Antes era imposible pedir menos preguntas que lecciones.
   */
  it("acepta menos preguntas que lecciones sin considerarlo un fallo", () => {
    const veinte: VideoConTranscripcion[] = Array.from({ length: 20 }, (_, i) => ({
      videoId: `v${i}`,
      title: `Lección ${i}`,
      transcript: "da igual",
    }));

    const { aceptadas, leccionesCubiertas } = limitarAlTotal(
      [pregunta("v3", "a"), pregunta("v7", "b"), pregunta("v11", "c")],
      veinte,
      5,
    );

    expect(aceptadas).toHaveLength(3);
    expect(leccionesCubiertas).toBe(3);
  });

  it("aparta las preguntas con un videoId que no se envió", () => {
    const { aceptadas, huerfanas } = limitarAlTotal(
      [pregunta("v1", "a"), pregunta("inventado", "b")],
      VIDEOS,
      5,
    );

    expect(aceptadas).toHaveLength(1);
    expect(huerfanas).toHaveLength(1);
  });

  it("no se atraganta con una respuesta vacía", () => {
    const { aceptadas, leccionesCubiertas } = limitarAlTotal([], VIDEOS, 5);
    expect(aceptadas).toEqual([]);
    expect(leccionesCubiertas).toBe(0);
  });
});

describe("validarPreguntasGeneradas", () => {
  it("guarda solo las preguntas cuyo fragmento está en su propio video", () => {
    const { validadas, descartadas } = validarPreguntasGeneradas(
      [pregunta("v1", "controla el ruido"), pregunta("v2", "ISO y obturador")],
      VIDEOS,
      "curso-1",
      VIDEOS.length,
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
      VIDEOS.length,
    );

    expect(validadas).toHaveLength(0);
    expect(descartadas).toBe(1);
  });

  it("nombra los videos que quedaron sin ninguna pregunta validada", () => {
    const { videosSinPreguntas } = validarPreguntasGeneradas(
      [pregunta("v1", "controla el ruido"), pregunta("v2", "esto no lo dijo nadie")],
      VIDEOS,
      "curso-1",
      VIDEOS.length,
    );

    expect(videosSinPreguntas).toEqual([{ videoId: "v2", title: "Cámara" }]);
  });

  it("conserva el título del video en la pregunta validada", () => {
    const { validadas } = validarPreguntasGeneradas(
      [pregunta("v1", "controla el ruido")],
      VIDEOS,
      "curso-1",
      VIDEOS.length,
    );
    expect(validadas[0].title).toBe("Iluminación");
  });
});

/**
 * Preguntas que remiten al material.
 *
 * El caso real que lo motivó: la primera generación contra un curso de verdad
 * devolvió 4 preguntas y 2 decían «según el video» / «se menciona en el video».
 * Para el modelo tiene sentido —está mirando una transcripción concreta—, para
 * el estudiante no: ve 16 preguntas seguidas y no hay ningún "el video".
 */
describe("detectarReferenciasAlMaterial", () => {
  const pregunta = (question: string): GeneratedQuestion => ({
    videoId: "11111111-1111-4111-8111-111111111111",
    question,
    options: ["a", "b", "c", "d"],
    correctAnswerIndex: 0,
    sourceFragment: "da igual",
  });

  it("caza las dos formas que salieron en la generación real", () => {
    const encontradas = detectarReferenciasAlMaterial([
      pregunta("¿Qué aspectos explora el campo de la teoría según el video?"),
      pregunta("¿Por qué se menciona en el video que no existe una teoría absoluta?"),
    ]);
    expect(encontradas).toHaveLength(2);
  });

  it("no marca una pregunta que se sostiene sola", () => {
    const encontradas = detectarReferenciasAlMaterial([
      pregunta("¿Quién escribió el primer tratado sobre arquitectura en el siglo I a. C.?"),
      pregunta("¿Cuál es la teoría imprescindible en los estudios de arquitectura?"),
    ]);
    expect(encontradas).toEqual([]);
  });

  it("ignora las tildes: «según» y «segun» son el mismo problema", () => {
    expect(detectarReferenciasAlMaterial([pregunta("¿X, segun el video?")])).toHaveLength(1);
    expect(detectarReferenciasAlMaterial([pregunta("¿X, SEGÚN EL VIDEO?")])).toHaveLength(1);
  });

  /**
   * La plataforma podría vender un curso de edición de video. Ahí «el video» es
   * el TEMA, no el medio, y marcarlo sería un falso positivo que llenaría
   * Sentry de ruido en el único curso donde la palabra es legítima.
   */
  it("no confunde el video como tema con el video como fuente", () => {
    const encontradas = detectarReferenciasAlMaterial([
      pregunta("¿Cuál es la resolución recomendada del video de salida?"),
      pregunta("¿Qué códec conviene para exportar un video de 4K?"),
    ]);
    expect(encontradas).toEqual([]);
  });
});
