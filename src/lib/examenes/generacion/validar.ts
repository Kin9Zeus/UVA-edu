import { logError } from "@/lib/log";
import { validateFragment } from "./fragmento";
import { AREA_LOG } from "./generar";
import type { GeneratedQuestion, VideoConTranscripcion } from "./tipos";

const SCOPE_LOG = "examenes:generacion";

export type PreguntaValidada = GeneratedQuestion & {
  /** Título del video del que salió, para el panel de revisión. */
  title: string;
};

export type ResultadoValidacion = {
  validadas: PreguntaValidada[];
  /** Videos que quedaron con CERO preguntas validadas: los que un
   * administrador tiene que mirar a mano. */
  videosSinPreguntas: { videoId: string; title: string }[];
  descartadas: number;
};

/**
 * Comprueba, pregunta por pregunta, que el fragmento citado aparece en la
 * transcripción DE SU PROPIO VIDEO.
 *
 * El detalle que hace o rompe esta función: se busca la transcripción de
 * `pregunta.videoId` y se valida SOLO contra esa. No se concatenan las
 * transcripciones del curso. Con todo concatenado, la comprobación degenera en
 * "esta frase se dijo en algún momento del curso" y deja pasar exactamente el
 * error que el prompt pide evitar — una pregunta del video 3 anclada a una
 * frase del video 7. El estudiante la ve mientras repasa el video 3 y no tiene
 * cómo responderla.
 *
 * Un video con cero preguntas validadas no falla la corrida: se registra con
 * `area: "exam-generation"` y `videoId` para que un administrador lo revise —
 * casi siempre significa que la transcripción es mala (audio con ruido, clase
 * sin narración, idioma mal detectado), no que el modelo se equivocara.
 */
export function validarPreguntasGeneradas(
  preguntas: GeneratedQuestion[],
  videos: VideoConTranscripcion[],
  courseId: string,
): ResultadoValidacion {
  const porVideo = new Map(videos.map((video) => [video.videoId, video]));

  const validadas: PreguntaValidada[] = [];
  let descartadas = 0;

  for (const pregunta of preguntas) {
    const video = porVideo.get(pregunta.videoId);

    // `repartirPorVideo()` ya descartó las preguntas con videoId desconocido,
    // así que llegar acá sin video sería un fallo de programación, no un
    // capricho del modelo. Se registra como tal en vez de ignorarlo en
    // silencio: si esta rama se enciende, hay un bug en el pipeline.
    if (!video) {
      logError(SCOPE_LOG, "pregunta con videoId desconocido llegó a la validación", null, {
        area: AREA_LOG,
        courseId,
        videoId: pregunta.videoId,
      });
      descartadas += 1;
      continue;
    }

    const resultado = validateFragment(pregunta.sourceFragment, video.transcript);

    if (!resultado.valido) {
      descartadas += 1;
      logError(SCOPE_LOG, "se descarta una pregunta: el fragmento no valida", null, {
        area: AREA_LOG,
        courseId,
        videoId: pregunta.videoId,
        motivo: resultado.motivo,
      });
      continue;
    }

    validadas.push({ ...pregunta, title: video.title });
  }

  const conPreguntas = new Set(validadas.map((pregunta) => pregunta.videoId));
  const videosSinPreguntas = videos
    .filter((video) => !conPreguntas.has(video.videoId))
    .map((video) => ({ videoId: video.videoId, title: video.title }));

  for (const video of videosSinPreguntas) {
    logError(
      SCOPE_LOG,
      "el video quedó sin ninguna pregunta validada; revisar la transcripción a mano",
      null,
      { area: AREA_LOG, videoId: video.videoId, courseId },
    );
  }

  return { validadas, videosSinPreguntas, descartadas };
}
