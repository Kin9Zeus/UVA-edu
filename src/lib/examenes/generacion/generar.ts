import type { Schema } from "@google/genai";
import { crearClienteGemini, MODELO_GENERACION_EXAMEN } from "@/lib/gemini/client";
import { logError } from "@/lib/log";
import { construirMensajeUsuario, construirSystemPrompt } from "./prompt";
import { obtenerVideosConTranscripcion } from "./transcripciones";
import {
  ESQUEMA_RESPUESTA_GEMINI,
  MAXIMO_VIDEOS_POR_LLAMADA,
  PREGUNTAS_POR_VIDEO_MAXIMO,
  PREGUNTAS_POR_VIDEO_MINIMO,
  respuestaGeneracionSchema,
  type GeneratedQuestion,
  type VideoConTranscripcion,
} from "./tipos";

/** `area` de logError para todo este módulo. Un solo string, para que las
 * alertas de Sentry agrupen la generación de exámenes igual que "webhook"
 * agrupa las tres pasarelas (ver src/lib/log.ts). */
export const AREA_LOG = "exam-generation";

const SCOPE_LOG = "examenes:generacion";

/**
 * Deja en `questionsPerVideo` preguntas por video, como máximo, y descarta lo
 * que no encaja.
 *
 * Tres cosas que el modelo hace y que hay que absorber sin tumbar la corrida
 * entera — el examen de 19 videos correctos no se tira porque el 20 salió mal:
 *
 *   - devolver MENOS preguntas para algún video. Se registra y se sigue: el
 *     administrador verá en el panel que ese video quedó corto.
 *   - devolver MÁS de las pedidas. Se recorta a las primeras N.
 *   - devolver un `videoId` que no se envió (inventado, o el título en vez del
 *     id). No se puede ni validar el fragmento ni guardar la fila, así que se
 *     descarta. Es distinto de "vinieron pocas" y por eso se cuenta aparte.
 */
export function repartirPorVideo(
  preguntas: GeneratedQuestion[],
  videos: VideoConTranscripcion[],
  questionsPerVideo: number,
): {
  aceptadas: GeneratedQuestion[];
  huerfanas: GeneratedQuestion[];
  faltantesPorVideo: { videoId: string; title: string; recibidas: number }[];
} {
  const conocidos = new Map(videos.map((video) => [video.videoId, video]));
  const porVideo = new Map<string, GeneratedQuestion[]>();
  const huerfanas: GeneratedQuestion[] = [];

  for (const pregunta of preguntas) {
    if (!conocidos.has(pregunta.videoId)) {
      huerfanas.push(pregunta);
      continue;
    }
    const acumuladas = porVideo.get(pregunta.videoId) ?? [];
    acumuladas.push(pregunta);
    porVideo.set(pregunta.videoId, acumuladas);
  }

  const aceptadas: GeneratedQuestion[] = [];
  const faltantesPorVideo: { videoId: string; title: string; recibidas: number }[] = [];

  // Se recorre `videos` y no `porVideo` para que el orden de las preguntas siga
  // el orden del temario, y para que un video con CERO preguntas aparezca en
  // `faltantesPorVideo` — no existe como clave en el Map, así que iterar el Map
  // lo dejaría fuera justo en el caso que más importa reportar.
  for (const video of videos) {
    const suyas = porVideo.get(video.videoId) ?? [];
    if (suyas.length < questionsPerVideo) {
      faltantesPorVideo.push({
        videoId: video.videoId,
        title: video.title,
        recibidas: suyas.length,
      });
    }
    aceptadas.push(...suyas.slice(0, questionsPerVideo));
  }

  return { aceptadas, huerfanas, faltantesPorVideo };
}

/**
 * Genera las preguntas del examen de un curso a partir de las transcripciones
 * de TODOS sus videos, en una sola llamada.
 *
 * Una llamada y no una por video, que sería más simple de escribir: el
 * enunciado del prompt —"no mezcles conceptos de un video en la pregunta de
 * otro"— solo tiene sentido si el modelo ve el curso entero. Con una llamada
 * por video, cada pregunta se genera sin saber qué se explicó en las otras
 * clases y el examen se llena de preguntas repetidas con distinta redacción.
 *
 * NO persiste nada. Devolver las preguntas y guardarlas son dos pasos
 * separados a propósito: entre uno y otro va `validarPreguntasGeneradas()`, y
 * el panel de admin va a querer enseñarlas antes de escribir en un examen que
 * quizá ya tiene intentos rendidos.
 *
 * @throws {TranscripcionesFaltantesError} si algún video del curso todavía no
 *   tiene transcripción — nunca genera un examen incompleto en silencio.
 * @throws {CursoSinVideosError} si el curso no tiene ningún video listo.
 */
export async function generateCourseExam(
  courseId: string,
  questionsPerVideo: number,
): Promise<GeneratedQuestion[]> {
  if (
    !Number.isInteger(questionsPerVideo) ||
    questionsPerVideo < PREGUNTAS_POR_VIDEO_MINIMO ||
    questionsPerVideo > PREGUNTAS_POR_VIDEO_MAXIMO
  ) {
    throw new Error(
      `questionsPerVideo debe ser un entero entre ${PREGUNTAS_POR_VIDEO_MINIMO} y ${PREGUNTAS_POR_VIDEO_MAXIMO}.`,
    );
  }

  // Lanza TranscripcionesFaltantesError / CursoSinVideosError. Se deja
  // propagar: son exactamente el "error claro indicando cuáles videos faltan"
  // que el llamador tiene que poder mostrar.
  const videos = await obtenerVideosConTranscripcion(courseId);

  if (videos.length > MAXIMO_VIDEOS_POR_LLAMADA) {
    throw new Error(
      `El curso tiene ${videos.length} videos y el máximo por generación es ${MAXIMO_VIDEOS_POR_LLAMADA}. ` +
        "Divide el curso o genera el examen por módulos.",
    );
  }

  const cliente = crearClienteGemini();

  const respuesta = await cliente.models.generateContent({
    model: MODELO_GENERACION_EXAMEN,
    contents: construirMensajeUsuario(videos),
    config: {
      systemInstruction: construirSystemPrompt(questionsPerVideo),
      // Salida estructurada: el servidor obliga la forma, así que no hay que
      // pelearse con markdown, ```json de adorno ni texto antes del objeto.
      responseMimeType: "application/json",
      responseSchema: ESQUEMA_RESPUESTA_GEMINI as unknown as Schema,
      // Alto a propósito: 40 videos × 10 preguntas × (enunciado + 4 opciones +
      // fragmento) es mucha salida, y quedarse corto trunca el JSON a mitad —
      // que con salida estructurada no es una pregunta menos, es la corrida
      // entera perdida porque el objeto no cierra.
      maxOutputTokens: 32000,
      // Razonar le sirve: tiene que repartir preguntas entre videos sin
      // mezclar conceptos y encontrar una frase textual que sostenga cada una.
      // -1 = presupuesto automático, que el modelo ajusta a la dificultad.
      thinkingConfig: { thinkingBudget: -1 },
      // Determinismo relativo: es un examen calificable, no texto creativo.
      // Regenerar el mismo curso no debería producir preguntas radicalmente
      // distintas cada vez.
      temperature: 0.3,
    },
  });

  // Gemini puede terminar sin texto por varias razones que NO son excepciones:
  // el filtro de seguridad cortó la respuesta, se agotó el presupuesto de
  // salida, o el candidato vino vacío. Sin esta comprobación, todas se
  // manifestarían como un JSON.parse de `undefined` sin causa visible.
  const motivoCorte = respuesta.candidates?.[0]?.finishReason;

  if (motivoCorte === "MAX_TOKENS") {
    throw new Error(
      "La respuesta del modelo se cortó por longitud. Genera el examen con menos preguntas por video.",
    );
  }

  if (motivoCorte && motivoCorte !== "STOP") {
    throw new Error(`El modelo no completó la respuesta (${motivoCorte}).`);
  }

  const texto = respuesta.text;
  if (!texto) {
    throw new Error("El modelo no devolvió ningún contenido.");
  }

  // Doble puerta, y las dos hacen falta: `responseSchema` garantiza la FORMA,
  // pero no los límites de negocio (longitudes, que `correctAnswerIndex`
  // apunte a una opción que existe). Eso lo comprueba Zod acá.
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new Error("El modelo no devolvió JSON válido.");
  }

  const parseado = respuestaGeneracionSchema.safeParse(crudo);
  if (!parseado.success) {
    logError(SCOPE_LOG, "la respuesta del modelo no pasó la validación de Zod", null, {
      area: AREA_LOG,
      courseId,
      problemas: parseado.error.issues.slice(0, 5).map((issue) => ({
        ruta: issue.path.join("."),
        mensaje: issue.message,
      })),
    });
    throw new Error("El modelo no devolvió un JSON con la forma esperada.");
  }

  const { aceptadas, huerfanas, faltantesPorVideo } = repartirPorVideo(
    parseado.data.questions,
    videos,
    questionsPerVideo,
  );

  // No se falla la corrida: son avisos de calidad, no de corrección. Se
  // registran uno por video para que la alerta de Sentry agrupe por `videoId`
  // y se vea cuál clase falla siempre.
  for (const video of faltantesPorVideo) {
    logError(
      SCOPE_LOG,
      `el modelo devolvió ${video.recibidas} de ${questionsPerVideo} preguntas para el video`,
      null,
      { area: AREA_LOG, videoId: video.videoId, courseId, recibidas: video.recibidas },
    );
  }

  if (huerfanas.length > 0) {
    logError(
      SCOPE_LOG,
      "el modelo devolvió preguntas con un videoId que no se le envió; se descartan",
      null,
      {
        area: AREA_LOG,
        courseId,
        cantidad: huerfanas.length,
        idsDesconocidos: [...new Set(huerfanas.map((pregunta) => pregunta.videoId))],
      },
    );
  }

  return aceptadas;
}
