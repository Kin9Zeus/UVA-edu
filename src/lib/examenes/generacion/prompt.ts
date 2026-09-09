import {
  MAXIMO_PALABRAS_FRAGMENTO,
  OPCIONES_POR_PREGUNTA,
  type VideoConTranscripcion,
} from "./tipos";

/**
 * System prompt de la generación.
 *
 * Se arma con `questionsPerVideo` interpolado en vez de ser una constante: es
 * el único parámetro que el administrador elige, y meterlo en la instrucción
 * de sistema —en vez de pedirlo dentro del mensaje con las transcripciones—
 * mantiene el mensaje de usuario como puro dato.
 *
 * Este texto es agnóstico del proveedor a propósito: no menciona ningún modelo
 * ni ninguna peculiaridad de su API. Cambiar de proveedor (como ya pasó una
 * vez) no debería tocar este archivo.
 *
 * Las tres reglas que están acá por una razón concreta, y no por adorno:
 *
 *   1. "basadas ÚNICAMENTE en el contenido de ESE video". Sin esto el modelo
 *      mezcla: con 20 transcripciones del mismo tema delante, la pregunta del
 *      video 3 sale citando algo del 7. El estudiante que repasa el video 3
 *      no tiene forma de responderla.
 *   2. "No inventes información". Es la instrucción que `validateFragment`
 *      después COMPRUEBA. Pedirlo sin verificarlo no sirve de nada; verificarlo
 *      sin pedirlo desperdicia la mitad de las preguntas.
 *   3. El fragmento textual. Es lo que hace la pregunta auditable por un
 *      humano en segundos, y lo único que un programa puede comprobar.
 */
export function construirSystemPrompt(questionsPerVideo: number): string {
  return [
    "Eres un generador de exámenes para un curso online. Vas a recibir la",
    "transcripción de varios videos del mismo curso, cada uno identificado por",
    `su ID y título. Genera EXACTAMENTE ${questionsPerVideo} preguntas de opción`,
    "múltiple por cada video, nivel bajo-intermedio, basadas ÚNICAMENTE en el",
    "contenido de ESE video específico — no mezcles conceptos de un video en",
    "la pregunta de otro. No inventes información que no esté en las transcripciones.",
    "",
    "Para cada pregunta incluye: videoId (a cuál video pertenece), question,",
    `options (${OPCIONES_POR_PREGUNTA}), correctAnswerIndex, sourceFragment (frase textual de máx ${MAXIMO_PALABRAS_FRAGMENTO}`,
    "palabras tomada de la transcripción de ESE video).",
    "",
    "Responde SOLO en JSON: un array de preguntas.",
  ].join("\n");
}

/**
 * Mensaje de usuario: la lista de videos con su transcripción, como JSON.
 *
 * JSON y no prosa con encabezados porque el `videoId` tiene que volver
 * intacto en cada pregunta. Un id dentro de un párrafo («Video 3 —
 * Iluminación (id: 4f3a…)») invita al modelo a reescribirlo, abreviarlo o
 * referirse a él como "el tercero"; como valor de una clave JSON, copiarlo
 * literal es el camino de menor resistencia.
 *
 * Indentado con 2 espacios: cuesta unos tokens y hace legible el prompt
 * cuando haya que depurar por qué un curso salió mal.
 */
export function construirMensajeUsuario(videos: VideoConTranscripcion[]): string {
  return JSON.stringify(
    videos.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      transcript: video.transcript,
    })),
    null,
    2,
  );
}
