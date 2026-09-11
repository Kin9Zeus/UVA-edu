import {
  CAMPOS_PREGUNTA_GENERADA,
  MAXIMO_PALABRAS_FRAGMENTO,
  OPCIONES_POR_PREGUNTA,
  type VideoConTranscripcion,
} from "./tipos";

/**
 * Marcador obligatorio del prompt: dónde va el total de preguntas del examen.
 *
 * Es el único parámetro que el administrador elige en el panel, así que un
 * prompt que no lo interpole devolvería siempre la misma cantidad y dejaría el
 * control de la interfaz sin efecto.
 */
const MARCADOR_PREGUNTAS = "{totalPreguntas}";

/** Marcadores opcionales, por comodidad de quien escriba un prompt propio. */
const MARCADOR_OPCIONES = "{opcionesPorPregunta}";
const MARCADOR_PALABRAS = "{maximoPalabrasFragmento}";

/**
 * System prompt por defecto.
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
 *   4. "Cada pregunta debe entenderse POR SÍ SOLA". Sin esto, la mitad salen
 *      con «según el video» pegado al final — medido: 2 de 4 en la primera
 *      generación real. Tiene sentido para el modelo, que está viendo una
 *      transcripción concreta, y ninguno para el estudiante, que ve 16
 *      preguntas seguidas sin saber cuál vino de dónde. La procedencia existe,
 *      pero es información para el ADMINISTRADOR (columna `id_leccion_origen`,
 *      panel de examen); el examen en sí no la muestra.
 */
const PROMPT_POR_DEFECTO = [
  "Eres un generador de exámenes para un curso online. Vas a recibir la",
  "transcripción de varios videos del mismo curso, cada uno identificado por",
  `su ID y título. Genera EXACTAMENTE ${MARCADOR_PREGUNTAS} preguntas de opción`,
  "múltiple EN TOTAL para todo el curso, nivel bajo-intermedio.",
  "",
  "TÚ ELIGES QUÉ PREGUNTAR. No tienes que cubrir todas las lecciones: escoge",
  "los conceptos más importantes y evaluables del curso, los que alguien que",
  "lo hizo de verdad debería saber. Descarta lo anecdótico, las presentaciones",
  "y lo que se repita en varias clases.",
  "",
  "REPARTO: mientras queden lecciones sin ninguna pregunta, no pongas una",
  "segunda pregunta de la misma lección. Solo cuando todas tengan al menos una",
  "puedes empezar a repetir lección.",
  "",
  "Cada pregunta se basa ÚNICAMENTE en el contenido de UNA lección, la que",
  "indiques en videoId — no mezcles conceptos de una lección en la pregunta de",
  "otra. No inventes información que no esté en las transcripciones.",
  "",
  "Cada pregunta debe entenderse POR SÍ SOLA. El estudiante ve el examen",
  "completo y no sabe de qué video salió cada pregunta, así que NO escribas",
  "«según el video», «en esta clase», «el profesor explica», «se menciona» ni",
  "ninguna referencia al material. Pregunta directamente por el concepto:",
  "en vez de «¿Qué explica el video sobre X?», escribe «¿Qué es X?».",
  "",
  "Para cada pregunta incluye: videoId (a cuál video pertenece), question,",
  `options (${MARCADOR_OPCIONES}), correctAnswerIndex, sourceFragment (frase textual de máx ${MARCADOR_PALABRAS}`,
  "palabras tomada de la transcripción de ESE video).",
  "",
  "Responde SOLO en JSON: un array de preguntas.",
].join("\n");

/**
 * Comprueba que un prompt escrito a mano siga cumpliendo su contrato con el
 * resto del pipeline.
 *
 * POR QUÉ EXISTE ESTA GUARDA
 * --------------------------
 * El prompt y el validador son la misma decisión escrita en dos sitios: el
 * prompt PIDE `sourceFragment`, y `validateFragment()` EXIGE que esa frase
 * aparezca palabra por palabra en la transcripción. Ese par es el mecanismo
 * que impide que un examen califique a alguien con algo que el video nunca
 * dijo.
 *
 * Si un prompt puesto desde el entorno deja de pedir el fragmento, el
 * validador descarta el 100% de las preguntas. El resultado es un examen
 * vacío, sin una sola excepción y sin nada en Sentry — el peor modo de fallo
 * posible, porque parece que funcionó.
 *
 * Por eso la lista de campos no se escribe acá: se toma de
 * `CAMPOS_PREGUNTA_GENERADA`, que es la misma constante contra la que
 * `tipos.test.ts` compara el schema de Zod y el de Gemini. Así, si mañana el
 * esquema gana un campo, esta guarda empieza a exigirlo en el prompt sola, sin
 * que nadie tenga que acordarse de actualizarla.
 */
export function validaPromptSistema(prompt: string): void {
  if (prompt.trim().length === 0) {
    throw new Error("GEMINI_SYSTEM_PROMPT está definida pero vacía.");
  }

  const faltantes = CAMPOS_PREGUNTA_GENERADA.filter((campo) => !prompt.includes(campo));
  if (faltantes.length > 0) {
    throw new Error(
      `GEMINI_SYSTEM_PROMPT no menciona ${faltantes.join(", ")}. ` +
        "El esquema de respuesta exige esos campos y el validador de fragmentos depende de " +
        "sourceFragment: un prompt que no los pida produce exámenes vacíos sin dar ningún error. " +
        `Campos obligatorios: ${CAMPOS_PREGUNTA_GENERADA.join(", ")}.`,
    );
  }

  if (!prompt.includes(MARCADOR_PREGUNTAS)) {
    throw new Error(
      `GEMINI_SYSTEM_PROMPT no contiene ${MARCADOR_PREGUNTAS}, así que ignoraría el total ` +
        "del examen que elige el administrador en el panel. Escríbelo donde vaya el número.",
    );
  }
}

/**
 * System prompt de la generación.
 *
 * `totalPreguntas` se interpola en vez de ser una constante: es el único
 * parámetro que el administrador elige, y meterlo en la instrucción de sistema
 * —en vez de pedirlo dentro del mensaje con las transcripciones— mantiene el
 * mensaje de usuario como puro dato.
 *
 * SE PUEDE SUSTITUIR DESDE EL ENTORNO (`GEMINI_SYSTEM_PROMPT`)
 * -------------------------------------------------------------
 * El caso que lo justifica no es iterar —para eso está
 * `npm run examenes:probar-generacion`, que da la vuelta completa en segundos
 * y sin tocar la base—, sino el otro: producción sacando preguntas malas un
 * domingo y poder arreglarlo sin abrir el repositorio.
 *
 * A cambio de esa comodidad se pierde el historial: un prompt en Railway no
 * tiene autor, ni diff, ni forma de revertirlo. Por eso lo que pasa por acá se
 * valida (ver `validaPromptSistema`) y por eso el valor por defecto sigue
 * siendo el del código: un despliegue sin la variable usa el texto revisado.
 */
export function construirSystemPrompt(totalPreguntas: number): string {
  const desdeEntorno = process.env.GEMINI_SYSTEM_PROMPT;
  const plantilla = desdeEntorno?.trim() ? desdeEntorno : PROMPT_POR_DEFECTO;

  if (plantilla !== PROMPT_POR_DEFECTO) {
    validaPromptSistema(plantilla);
  }

  return plantilla
    .replaceAll(MARCADOR_PREGUNTAS, String(totalPreguntas))
    .replaceAll(MARCADOR_OPCIONES, String(OPCIONES_POR_PREGUNTA))
    .replaceAll(MARCADOR_PALABRAS, String(MAXIMO_PALABRAS_FRAGMENTO));
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
