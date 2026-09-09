import { z } from "zod";

/**
 * Contratos del pipeline "generar el examen de un curso a partir de las
 * transcripciones de TODOS sus videos".
 *
 * Módulo sin "use server" ni acceso a base de datos, igual que
 * src/lib/examenes/tipos.ts: lo importan los Server Actions, el webhook de
 * Mux y los tests.
 *
 * Vocabulario — una advertencia que ahorra confusiones:
 *
 *   "video"  en este módulo es una LECCIÓN (`lecciones`). Es la fila que
 *            tiene el asset de Mux y el título. `videoId` es siempre un
 *            `lecciones.id`, nunca un asset id ni un playback id de Mux.
 *   "curso"  es el dueño del examen. Ya lo era antes de este módulo:
 *            `examenes.id_curso` es UNIQUE desde la migración
 *            20260907020000_examenes_finales.
 */

// ------------------------------------------------------------
// Disparadores
// ------------------------------------------------------------

/**
 * Qué puede originar una corrida de generación.
 *
 * Esta lista y el CHECK `trabajos_generacion_examen_disparado_por_valido` de
 * la migración son la misma verdad escrita dos veces; `tipos.test.ts` falla
 * si se separan. Mismo patrón que `ProveedorWebhook` contra el CHECK de
 * `eventos_webhook` (supabase/sql/042).
 *
 * ADMIN_MANUAL    el botón "generar/regenerar examen del curso". SIEMPRE
 *                 procede, incluso sobre un examen ya generado y validado:
 *                 regenerar es exactamente lo que se pidió.
 * VIDEO_AGREGADO  se subió un video nuevo al curso y su transcripción quedó
 *                 lista. Se RETIRA si el curso ya tiene un examen generado y
 *                 validado — ver `puedeGenerarExamenCurso()`.
 *
 * Lo que no está en esta lista, y es deliberado: el webhook de cada video.
 * `video.asset.track.ready` guarda la transcripción y no dispara nada.
 */
export const DISPARADORES_GENERACION = ["ADMIN_MANUAL", "VIDEO_AGREGADO"] as const;

export type DisparadorGeneracion = (typeof DISPARADORES_GENERACION)[number];

// ------------------------------------------------------------
// Límites
// ------------------------------------------------------------

/** Preguntas por video que acepta pedir `generateCourseExam`. Más de 10 por
 * clase deja de ser un examen y empieza a ser un interrogatorio; menos de 1
 * no tiene sentido. */
export const PREGUNTAS_POR_VIDEO_MINIMO = 1;
export const PREGUNTAS_POR_VIDEO_MAXIMO = 10;

/** Opciones por pregunta. Fijo en 4: el prompt las pide así y
 * `aOpcionesPregunta()` asume esa forma al mapear `correctAnswerIndex`. */
export const OPCIONES_POR_PREGUNTA = 4;

/** Tope de palabras del fragmento citado. El prompt lo pide y el schema lo
 * impone: un "fragmento" de 200 palabras es la transcripción entera y deja de
 * ser evidencia de nada — validaría siempre. */
export const MAXIMO_PALABRAS_FRAGMENTO = 20;

/**
 * Techo de transcripciones que se mandan en una sola llamada.
 *
 * No es un límite de la API (el contexto del modelo da de sobra para 40
 * transcripciones), es un límite de producto: un curso de más de 40 clases produciría un examen
 * de cientos de preguntas que nadie va a revisar a mano, y una sola llamada
 * de varios minutos con todo o nada en juego. Cuando exista un curso así, la
 * respuesta correcta es trocear por módulos, no subir esta constante.
 */
export const MAXIMO_VIDEOS_POR_LLAMADA = 40;

// ------------------------------------------------------------
// Entrada: un video con su transcripción
// ------------------------------------------------------------

/** Lo que el pipeline necesita saber de un video para generar sus preguntas. */
export type VideoConTranscripcion = {
  /** `lecciones.id`. */
  videoId: string;
  title: string;
  transcript: string;
};

// ------------------------------------------------------------
// Salida del modelo
// ------------------------------------------------------------

/**
 * Una pregunta tal como la devuelve el modelo.
 *
 * Forma deliberadamente más simple que `PreguntaCompleta`
 * (src/lib/examenes/tipos.ts): texto plano en vez de documento Tiptap, e
 * índice de la correcta en vez de `[{ id, texto, correcta }]`. El modelo no
 * tiene por qué conocer el formato interno del CMS, y pedirle JSON de
 * ProseMirror es superficie extra para que se equivoque.
 *
 * La traducción a la forma del CMS ocurre en un solo sitio,
 * `persistirPreguntasGeneradas()`.
 */
export const preguntaGeneradaSchema = z.object({
  /** A cuál video pertenece. Se verifica contra los videos realmente
   * enviados: el modelo puede inventarse un id, y una pregunta con un
   * `videoId` desconocido no se puede ni validar ni guardar. */
  videoId: z.string().min(1),
  question: z.string().trim().min(1).max(1000),
  options: z
    .array(z.string().trim().min(1).max(500))
    .length(OPCIONES_POR_PREGUNTA),
  correctAnswerIndex: z.number().int().min(0).max(OPCIONES_POR_PREGUNTA - 1),
  sourceFragment: z.string().trim().min(1).max(1000),
});

export type GeneratedQuestion = z.infer<typeof preguntaGeneradaSchema>;

/** La respuesta completa. Un objeto con `questions` y no un array pelado: la
 * salida estructurada de Gemini exige un schema de objeto en la raíz. */
export const respuestaGeneracionSchema = z.object({
  questions: z.array(preguntaGeneradaSchema),
});

/**
 * El MISMO contrato, escrito en el dialecto de Gemini (`responseSchema`, un
 * subconjunto de OpenAPI 3.0).
 *
 * Son dos schemas y no uno derivado del otro a propósito, aunque `z.toJSONSchema()`
 * exista en Zod 4: `responseJsonSchema` de Gemini solo admite una lista corta
 * de palabras clave —`type`, `items`, `properties`, `required`, `enum`,
 * `minItems`/`maxItems`, `minimum`/`maximum`…— que NO incluye
 * `minLength`/`maxLength`, y este schema los usa en casi todos los campos.
 * Convertir automáticamente produciría un schema con propiedades que el
 * servidor ignora o rechaza, y el fallo aparecería como un 400 opaco.
 *
 * La división del trabajo entre los dos es la que importa:
 *
 *   ESQUEMA_RESPUESTA_GEMINI  fuerza la FORMA (el modelo no puede devolver
 *                             otra cosa; es una garantía del decodificador).
 *   respuestaGeneracionSchema valida el CONTENIDO (longitudes, rangos, que
 *                             `correctAnswerIndex` apunte a una opción real).
 *
 * Que el segundo sea más estricto es correcto y deliberado: la forma la
 * garantiza el servidor, los límites de negocio los seguimos comprobando
 * nosotros. `tipos.test.ts` verifica que los dos enumeren los mismos campos,
 * para que agregar uno al schema de Zod y olvidarlo acá falle en CI y no en
 * producción — mismo criterio que `DISPARADORES_GENERACION` contra su CHECK.
 */
export const ESQUEMA_RESPUESTA_GEMINI = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          videoId: {
            type: "STRING",
            description: "El videoId EXACTO, copiado literal, del video al que pertenece la pregunta.",
          },
          question: { type: "STRING", description: "El enunciado de la pregunta." },
          options: {
            type: "ARRAY",
            items: { type: "STRING" },
            minItems: OPCIONES_POR_PREGUNTA,
            maxItems: OPCIONES_POR_PREGUNTA,
            description: `Exactamente ${OPCIONES_POR_PREGUNTA} opciones.`,
          },
          correctAnswerIndex: {
            type: "INTEGER",
            minimum: 0,
            maximum: OPCIONES_POR_PREGUNTA - 1,
            description: "Índice (base 0) de la opción correcta dentro de `options`.",
          },
          sourceFragment: {
            type: "STRING",
            description:
              `Frase TEXTUAL de máximo ${MAXIMO_PALABRAS_FRAGMENTO} palabras, copiada literal de la ` +
              "transcripción de ESE video. Se verifica automáticamente contra la transcripción: " +
              "si no aparece tal cual, la pregunta se descarta.",
          },
        },
        required: ["videoId", "question", "options", "correctAnswerIndex", "sourceFragment"],
        // Fija el orden en que el modelo emite los campos. Sin esto el orden es
        // arbitrario, lo que no rompe el parseo pero sí ensucia los diffs al
        // depurar una respuesta guardada.
        propertyOrdering: [
          "videoId",
          "question",
          "options",
          "correctAnswerIndex",
          "sourceFragment",
        ],
      },
    },
  },
  required: ["questions"],
} as const;

/** Campos de una pregunta, en un solo sitio: lo que compara `tipos.test.ts`
 * entre el schema de Zod y el de Gemini. */
export const CAMPOS_PREGUNTA_GENERADA = [
  "videoId",
  "question",
  "options",
  "correctAnswerIndex",
  "sourceFragment",
] as const;

// ------------------------------------------------------------
// Errores
// ------------------------------------------------------------

/**
 * Falta la transcripción de al menos un video del curso.
 *
 * Se lanza en vez de devolver un examen incompleto: un examen al que le
 * faltan las preguntas de tres clases sigue calificando sobre 100% y le
 * niega el certificado a alguien que sí vio el curso entero. El silencio
 * sería el peor resultado posible, así que el pipeline se detiene y nombra
 * los videos que faltan para que el administrador sepa qué esperar o qué
 * arreglar.
 *
 * Excepción a la convención de resultados discriminados del proyecto
 * (`ResultadoRegistro`, `EnviarCorreoResultado`): la firma pedida para
 * `generateCourseExam` devuelve `GeneratedQuestion[]`, así que el camino de
 * error tiene que ser una excepción. Los llamadores la capturan por
 * `instanceof` para poder listar `videosFaltantes` en la interfaz.
 */
export class TranscripcionesFaltantesError extends Error {
  readonly videosFaltantes: { videoId: string; title: string }[];

  constructor(videosFaltantes: { videoId: string; title: string }[]) {
    const listado = videosFaltantes.map((video) => `«${video.title}»`).join(", ");
    super(
      `No se puede generar el examen: ${videosFaltantes.length} ` +
        `${videosFaltantes.length === 1 ? "video todavía no tiene" : "videos todavía no tienen"} ` +
        `transcripción lista (${listado}).`,
    );
    this.name = "TranscripcionesFaltantesError";
    this.videosFaltantes = videosFaltantes;
  }
}

/** El curso no tiene ni un video con video listo del que generar preguntas. */
export class CursoSinVideosError extends Error {
  constructor(courseId: string) {
    super(`El curso ${courseId} no tiene lecciones con video listo.`);
    this.name = "CursoSinVideosError";
  }
}
