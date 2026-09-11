import type { GoogleGenAI, Schema } from "@google/genai";
import { configuracionGemini } from "@/lib/gemini/configuracion";
import { crearClienteGemini, esErrorTransitorio } from "@/lib/gemini/client";
import { logError } from "@/lib/log";
import { construirMensajeUsuario, construirSystemPrompt } from "./prompt";
import { obtenerVideosConTranscripcion } from "./transcripciones";
import {
  ESQUEMA_RESPUESTA_GEMINI,
  MAXIMO_VIDEOS_POR_LLAMADA,
  TOTAL_PREGUNTAS_MAXIMO,
  TOTAL_PREGUNTAS_MINIMO,
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
 * Acota la respuesta del modelo al total pedido y ordena las preguntas por
 * temario.
 *
 * Antes esta función repartía una cuota fija por video. Ya no: el
 * administrador pide un TOTAL y el modelo elige de qué lecciones sacarlo, así
 * que una lección sin preguntas es el funcionamiento normal —no un defecto—
 * cuando se piden menos preguntas que lecciones tiene el curso.
 *
 * Dos cosas que el modelo hace y que hay que absorber sin tumbar la corrida
 * entera:
 *
 *   - devolver MÁS de las pedidas. Se recorta al total. El recorte respeta el
 *     reparto por lección: se toma una vuelta completa por el temario antes de
 *     aceptar una segunda pregunta de la misma lección, así que si sobran, lo
 *     que se cae son las repeticiones y no la cobertura.
 *   - devolver un `videoId` que no se envió (inventado, o el título en vez del
 *     id). No se puede ni validar el fragmento ni guardar la fila, así que se
 *     descarta. Es distinto de "vinieron pocas" y por eso se cuenta aparte.
 */
export function limitarAlTotal(
  preguntas: GeneratedQuestion[],
  videos: VideoConTranscripcion[],
  totalPreguntas: number,
): {
  aceptadas: GeneratedQuestion[];
  huerfanas: GeneratedQuestion[];
  leccionesCubiertas: number;
} {
  const conocidos = new Set(videos.map((video) => video.videoId));
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

  // Vueltas por el temario: en la primera se toma la pregunta nº1 de cada
  // lección, en la segunda la nº2, y así. Recortar por aquí y no por el orden
  // en que vino la respuesta es lo que hace que un exceso se coma las
  // repeticiones en vez de dejar el examen concentrado en las tres primeras
  // clases.
  const aceptadas: GeneratedQuestion[] = [];
  const maximo = Math.max(...[...porVideo.values()].map((lista) => lista.length), 0);

  for (let vuelta = 0; vuelta < maximo && aceptadas.length < totalPreguntas; vuelta += 1) {
    for (const video of videos) {
      if (aceptadas.length >= totalPreguntas) break;
      const suyas = porVideo.get(video.videoId);
      const pregunta = suyas?.[vuelta];
      if (pregunta) aceptadas.push(pregunta);
    }
  }

  return {
    aceptadas,
    huerfanas,
    leccionesCubiertas: new Set(aceptadas.map((pregunta) => pregunta.videoId)).size,
  };
}

/**
 * Frases que delatan una pregunta escrita desde el punto de vista del modelo y
 * no del estudiante.
 *
 * Solo referencias AL MEDIO, nunca al tema. La distinción importa porque esta
 * plataforma podría vender un curso de edición de video, donde «¿cuál es la
 * resolución del video de salida?» es una pregunta perfectamente buena. Lo que
 * no puede aparecer es un deíctico: «este video», «esta clase», «el profesor»
 * — palabras que solo tienen referente si sabes de qué lección salió la
 * pregunta, y el estudiante no lo sabe.
 */
const REFERENCIAS_AL_MATERIAL = [
  "segun el video",
  "segun el audio",
  "segun la transcripcion",
  "en este video",
  "en esta clase",
  "en esta leccion",
  "el profesor",
  "el instructor",
  "el docente",
  "se menciona en",
  "se explica en",
];

/**
 * Preguntas que no se sostienen solas.
 *
 * El prompt lo PIDE (regla 4) y esto lo COMPRUEBA — el mismo par que forman
 * "no inventes información" y `validateFragment`. Sin la comprobación no hay
 * forma de enterarse de que un cambio de modelo dejó de respetar la regla.
 *
 * A diferencia del fragmento, acá NO se descarta la pregunta: «¿qué explica el
 * video sobre X?» sigue siendo respondible, solo está mal redactada. Perder una
 * pregunta le hace más daño al examen que una redacción torpe, así que se
 * registra y se deja pasar. Si empieza a salir en Sentry con frecuencia, lo que
 * hay que revisar es el prompt o el modelo, no las preguntas una a una.
 */
export function detectarReferenciasAlMaterial(
  preguntas: GeneratedQuestion[],
): GeneratedQuestion[] {
  return preguntas.filter((pregunta) => {
    const texto = pregunta.question
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    return REFERENCIAS_AL_MATERIAL.some((frase) => texto.includes(frase));
  });
}

/**
 * Una llamada a un modelo concreto. Devuelve el JSON crudo.
 *
 * Los motivos de corte se comprueban acá y se lanzan como errores normales —no
 * transitorios— a propósito: `MAX_TOKENS` o un corte del filtro de seguridad
 * se repetirían idénticos en el siguiente modelo de la cadena, así que caer no
 * arreglaría nada y solo gastaría el presupuesto entero antes de dar el mismo
 * resultado varios minutos más tarde.
 */
async function pedirAlModelo(
  cliente: GoogleGenAI,
  modelo: string,
  mensajeUsuario: string,
  systemPrompt: string,
): Promise<string> {
  const { temperatura, topP, maxTokensSalida } = configuracionGemini();

  const respuesta = await cliente.models.generateContent({
    model: modelo,
    contents: mensajeUsuario,
    config: {
      systemInstruction: systemPrompt,
      // Salida estructurada: el servidor obliga la forma, así que no hay que
      // pelearse con markdown, ```json de adorno ni texto antes del objeto.
      responseMimeType: "application/json",
      responseSchema: ESQUEMA_RESPUESTA_GEMINI as unknown as Schema,
      maxOutputTokens: maxTokensSalida,
      // Razonar le sirve: tiene que repartir preguntas entre videos sin
      // mezclar conceptos y encontrar una frase textual que sostenga cada una.
      // -1 = presupuesto automático, que el modelo ajusta a la dificultad.
      thinkingConfig: { thinkingBudget: -1 },
      temperature: temperatura,
      // Solo si GEMINI_TOP_P está definida. Sin ella no se manda el parámetro
      // y el modelo usa el suyo — que es lo que se quiere, porque la
      // temperatura ya acota la salida y mover las dos a la vez impide saber
      // cuál causó qué.
      ...(topP !== null && { topP }),
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

  return texto;
}

/**
 * Recorre la cadena de modelos hasta que uno responda.
 *
 * POR QUÉ UNA CADENA Y NO REINTENTOS
 * ----------------------------------
 * Antes eran 3 reintentos contra el mismo modelo, y eso falla justo cuando más
 * falta hace: un `503 UNAVAILABLE` significa que ESE modelo está saturado, así
 * que las tres llamadas caen en la misma cola. Pasó dos días seguidos con
 * `gemini-3.8-flash` mientras `gemini-3.6-flash` respondía en 3,2s en el mismo
 * instante. Con el mismo presupuesto de tiempo, preguntarle a tres modelos
 * distintos una vez es estrictamente mejor que preguntarle tres veces al que
 * ya dijo que no puede.
 *
 * Solo se cae al siguiente ante errores TRANSITORIOS (ver
 * `esErrorTransitorio`). Una clave inválida o un esquema mal formado fallan
 * igual en todos, y recorrer la cadena solo retrasaría el mismo error.
 *
 * Cada caída se registra: si un modelo falla siempre, hay que verlo en Sentry
 * y reordenar `GEMINI_MODELOS` — no descubrirlo por la factura.
 *
 * Exportada —como `limitarAlTotal`— para que
 * `npm run examenes:probar-generacion` ejercite ESTE camino y no una copia
 * suya: una prueba de humo que reimplementa lo que dice comprobar no comprueba
 * nada.
 */
export async function pedirConCadenaDeModelos(
  cliente: GoogleGenAI,
  mensajeUsuario: string,
  systemPrompt: string,
  courseId: string,
): Promise<string> {
  const { modelos, latenciaObjetivoMs } = configuracionGemini();
  const fallos: string[] = [];
  const inicio = Date.now();

  for (const [indice, modelo] of modelos.entries()) {
    try {
      const texto = await pedirAlModelo(cliente, modelo, mensajeUsuario, systemPrompt);

      // Terminó BIEN, pero lento. Se registra igual: una cola que se satura no
      // pasa de 3s a fallar de golpe, primero pasa a 40s durante unos días.
      // Sin esta señal esa fase es invisible y el primer aviso sería un examen
      // que no se generó. No altera el resultado; solo deja rastro.
      const tardanza = Date.now() - inicio;
      if (tardanza > latenciaObjetivoMs) {
        logError(SCOPE_LOG, "la generación superó la latencia objetivo", null, {
          area: AREA_LOG,
          courseId,
          modelo,
          msTranscurridos: tardanza,
          latenciaObjetivoMs,
          modelosDescartados: fallos.length,
        });
      }

      return texto;
    } catch (error) {
      const esUltimo = indice === modelos.length - 1;
      if (!esErrorTransitorio(error) || esUltimo) throw error;

      const detalle = error instanceof Error ? error.message : String(error);
      fallos.push(`${modelo}: ${detalle}`);

      logError(SCOPE_LOG, "el modelo no respondió; se pasa al siguiente de la cadena", error, {
        area: AREA_LOG,
        courseId,
        modeloFallido: modelo,
        modeloSiguiente: modelos[indice + 1],
        fallosPrevios: fallos.length,
      });
    }
  }

  // Inalcanzable: el último modelo de la cadena relanza su propio error, y
  // `leerModelos()` garantiza que la lista nunca esté vacía. Está por si
  // alguna de esas dos cosas deja de ser cierta.
  throw new Error(`Ningún modelo de la cadena respondió. ${fallos.join(" | ")}`);
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
  totalPreguntas: number,
): Promise<GeneratedQuestion[]> {
  if (
    !Number.isInteger(totalPreguntas) ||
    totalPreguntas < TOTAL_PREGUNTAS_MINIMO ||
    totalPreguntas > TOTAL_PREGUNTAS_MAXIMO
  ) {
    throw new Error(
      `totalPreguntas debe ser un entero entre ${TOTAL_PREGUNTAS_MINIMO} y ${TOTAL_PREGUNTAS_MAXIMO}.`,
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

  const texto = await pedirConCadenaDeModelos(
    crearClienteGemini(),
    construirMensajeUsuario(videos),
    construirSystemPrompt(totalPreguntas),
    courseId,
  );

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

  const { aceptadas, huerfanas, leccionesCubiertas } = limitarAlTotal(
    parseado.data.questions,
    videos,
    totalPreguntas,
  );

  // No se falla la corrida: es un aviso de calidad, no de corrección. Un examen
  // de 4 preguntas donde se pidieron 5 sigue sirviendo; lo que no puede es
  // pasar desapercibido, porque casi siempre significa que las
  // transcripciones dan menos de sí de lo que se creía.
  if (aceptadas.length < totalPreguntas) {
    logError(
      SCOPE_LOG,
      `el modelo devolvió ${aceptadas.length} de las ${totalPreguntas} preguntas pedidas`,
      null,
      {
        area: AREA_LOG,
        courseId,
        recibidas: aceptadas.length,
        pedidas: totalPreguntas,
        leccionesCubiertas,
        leccionesDelCurso: videos.length,
      },
    );
  }

  const conReferencias = detectarReferenciasAlMaterial(aceptadas);
  if (conReferencias.length > 0) {
    logError(
      SCOPE_LOG,
      "el modelo escribió preguntas que remiten al material («según el video»); se dejan pasar",
      null,
      {
        area: AREA_LOG,
        courseId,
        cantidad: conReferencias.length,
        deTotal: aceptadas.length,
        ejemplo: conReferencias[0]?.question,
      },
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
