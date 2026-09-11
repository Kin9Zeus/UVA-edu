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
  /** Videos que quedaron con CERO preguntas validadas. Con un examen más corto
   * que el temario es lo normal —el modelo eligió—; con uno igual o más largo,
   * es la lista que un administrador tiene que mirar a mano. */
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
 * Un video con cero preguntas validadas no falla la corrida.
 *
 * CUÁNDO ESO ES UN DEFECTO Y CUÁNDO NO
 * ------------------------------------
 * Depende de `totalPreguntas`, y por eso hace falta el parámetro. Si se piden
 * 5 preguntas para un curso de 20 lecciones, que 15 queden sin ninguna es el
 * funcionamiento correcto: el administrador pidió un examen corto y el modelo
 * eligió. Registrar 15 errores en Sentry por cada generación así sería ruido
 * puro, y el ruido acaba tapando las señales de verdad.
 *
 * Solo cuando se pidieron al menos tantas preguntas como lecciones tiene el
 * curso —o sea, cuando TODAS deberían haber caído— una lección vacía significa
 * algo: casi siempre que su transcripción es mala (audio con ruido, clase sin
 * narración, idioma mal detectado).
 *
 * La lista se devuelve SIEMPRE, en los dos casos: el panel la enseña para que
 * el administrador vea qué quedó fuera antes de publicar. Lo que cambia es si
 * además se alerta.
 */
export function validarPreguntasGeneradas(
  preguntas: GeneratedQuestion[],
  videos: VideoConTranscripcion[],
  courseId: string,
  totalPreguntas: number,
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

  // Ver el comentario de la función: con un examen más corto que el temario,
  // las lecciones vacías son la consecuencia esperada de lo que se pidió.
  const seEsperabaCubrirTodas = totalPreguntas >= videos.length;

  if (seEsperabaCubrirTodas) {
    for (const video of videosSinPreguntas) {
      logError(
        SCOPE_LOG,
        "el video quedó sin ninguna pregunta validada; revisar la transcripción a mano",
        null,
        { area: AREA_LOG, videoId: video.videoId, courseId, totalPreguntas },
      );
    }
  }

  return { validadas, videosSinPreguntas, descartadas };
}
