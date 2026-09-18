import { z } from "zod";
import { TIPOS_IMPLEMENTADOS, type TipoPreguntaImplementado } from "@/lib/examenes/tipos";

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

/**
 * Preguntas TOTALES que acepta pedir `generateCourseExam`, para el curso
 * entero.
 *
 * ANTES ERA "POR VIDEO", Y NO ESCALABA
 * ------------------------------------
 * El parámetro era `preguntasPorVideo`, así que el tamaño del examen lo
 * decidía el temario: un curso de 20 lecciones no podía tener menos de 20
 * preguntas ni pidiendo el mínimo. Para un curso largo eso no es un examen,
 * es una jornada — y el administrador no tenía ninguna forma de acortarlo.
 *
 * Con un total, el tamaño del examen es una decisión de producto y el modelo
 * se encarga de elegir QUÉ preguntar: 5 preguntas de un curso de 20 lecciones
 * salen de los 5 conceptos que más lo merecen, no de las 5 primeras clases.
 *
 * El mínimo es 1 y no un número "digno": un curso de una sola lección con un
 * examen de una pregunta es legítimo, y poner el listón más arriba solo
 * obligaría a inventar preguntas de relleno.
 *
 * El máximo es 60 porque por encima de eso nadie revisa el examen a mano
 * antes de publicarlo, que es el paso que impide que una pregunta mala llegue
 * a un estudiante.
 */
export const TOTAL_PREGUNTAS_MINIMO = 1;
export const TOTAL_PREGUNTAS_MAXIMO = 60;

/** Opciones por pregunta en los tipos de opción fija (OPCION_UNICA /
 * OPCION_MULTIPLE). Fijo en 4: el prompt las pide así y
 * `aOpcionesPregunta()` asume esa forma al mapear los índices correctos. */
export const OPCIONES_POR_PREGUNTA = 4;

/** Tope de palabras del fragmento citado. El prompt lo pide y el schema lo
 * impone: un "fragmento" de 200 palabras es la transcripción entera y deja de
 * ser evidencia de nada — validaría siempre. */
export const MAXIMO_PALABRAS_FRAGMENTO = 20;

/**
 * Pares por pregunta EMPAREJAR generada por IA.
 *
 * Rango propio, distinto de `MAXIMO_PARES_EMPAREJAR` (el tope del CMS para
 * una pregunta escrita a mano, que llega a 8): acá el mínimo importa tanto
 * como el máximo. Con 2 pares el emparejamiento se responde por descarte sin
 * saber ninguno de los dos; con más de 6 el modelo empieza a forzar
 * relaciones débiles solo para llenar cupo. El máximo se queda por debajo del
 * techo del CMS a propósito, para que un administrador que quiera una
 * pregunta más grande la complete a mano, no que la IA la infle.
 */
export const MINIMO_PARES_EMPAREJAR_GENERADOS = 3;
export const MAXIMO_PARES_EMPAREJAR_GENERADOS = 6;

/** Respuestas aceptadas por pregunta RELLENAR_ESPACIO generada. Entre 1 y 3:
 * suficiente para cubrir variantes obvias ("APU" / "Análisis de Precios
 * Unitarios") sin que el modelo liste sinónimos vagos que aceptan cualquier
 * cosa. */
export const MAXIMO_RESPUESTAS_ACEPTADAS_GENERADAS = 3;

/** Correctas exigidas en OPCION_MULTIPLE generada. El piso es 2 y no 1: con
 * una sola correcta la pregunta es indistinguible de OPCION_UNICA y el
 * "elige todas las que apliquen" del enunciado mentiría. El techo dejando
 * siempre al menos una incorrecta lo impone ya `preguntaEntradaSchema`
 * (src/lib/examenes/tipos.ts) — "no todas las opciones pueden ser
 * correctas" — así que se reproduce acá con la misma razón. */
export const MINIMO_CORRECTAS_OPCION_MULTIPLE = 2;

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
 * Tipos que el generador puede producir. Los mismos cinco que el CMS sabe
 * calificar sola (`TIPOS_IMPLEMENTADOS`, src/lib/examenes/tipos.ts) — no una
 * lista aparte: si mañana se habilita un sexto tipo ahí, este módulo lo ve
 * automáticamente y falta escribirle su rama de schema y su caso en
 * `persistirPreguntasGeneradas()`, no acordarse de agregarlo a otra lista.
 */
export const TIPOS_GENERABLES = TIPOS_IMPLEMENTADOS;

/** Campos que TODA pregunta generada lleva, sin importar el tipo. Es lo que
 * compara `tipos.test.ts` contra cada rama del schema de Gemini, y lo que
 * `validaPromptSistema()` exige en un prompt propio: sin `sourceFragment` no
 * hay forma de comprobar que el modelo no inventó la pregunta; sin `tipo` no
 * hay forma de saber cómo guardarla. */
export const CAMPOS_PREGUNTA_GENERADA = ["tipo", "videoId", "question", "sourceFragment"] as const;

const camposComunes = {
  /** A cuál video pertenece. Se verifica contra los videos realmente
   * enviados: el modelo puede inventarse un id, y una pregunta con un
   * `videoId` desconocido no se puede ni validar ni guardar. */
  videoId: z.string().min(1),
  question: z.string().trim().min(1).max(1000),
  sourceFragment: z.string().trim().min(1).max(1000),
};

/**
 * Una pregunta tal como la devuelve el modelo — unión discriminada por
 * `tipo`, una rama por cada entrada de `TIPOS_GENERABLES`.
 *
 * Formas deliberadamente más simples que `PreguntaCompleta`
 * (src/lib/examenes/tipos.ts): texto plano en vez de documento Tiptap, e
 * índices/booleanos en vez de `[{ id, texto, correcta }]` o `ParEmparejar[]`
 * con ids. El modelo no tiene por qué conocer el formato interno del CMS ni
 * inventar identificadores estables, y pedirle JSON de ProseMirror o UUIDs es
 * superficie extra para que se equivoque.
 *
 * La traducción a la forma del CMS —donde sí nacen esos ids— ocurre en un
 * solo sitio, `persistirPreguntasGeneradas()`.
 */
export const preguntaOpcionUnicaSchema = z.object({
  ...camposComunes,
  tipo: z.literal("OPCION_UNICA"),
  options: z.array(z.string().trim().min(1).max(500)).length(OPCIONES_POR_PREGUNTA),
  correctAnswerIndex: z.number().int().min(0).max(OPCIONES_POR_PREGUNTA - 1),
});

export const preguntaOpcionMultipleSchema = z.object({
  ...camposComunes,
  tipo: z.literal("OPCION_MULTIPLE"),
  options: z.array(z.string().trim().min(1).max(500)).length(OPCIONES_POR_PREGUNTA),
  /** Índices (base 0) de las opciones correctas. Se exige más de una y menos
   * que el total en el propio schema (`.refine`) y no solo en
   * `preguntaEntradaSchema` del CMS: una pregunta con una sola correcta o con
   * todas correctas nunca debería llegar a `persistirPreguntasGeneradas()`
   * para empezar, ni siquiera como "generada pero inválida". */
  correctAnswerIndices: z
    .array(z.number().int().min(0).max(OPCIONES_POR_PREGUNTA - 1))
    .min(MINIMO_CORRECTAS_OPCION_MULTIPLE)
    .max(OPCIONES_POR_PREGUNTA - 1)
    .refine((indices) => new Set(indices).size === indices.length, "Índices repetidos."),
});

export const preguntaVerdaderoFalsoSchema = z.object({
  ...camposComunes,
  tipo: z.literal("VERDADERO_FALSO"),
  /** `question` es la AFIRMACIÓN a calificar (no una pregunta con signos de
   * interrogación): "El acero de refuerzo se mide en kg", no "¿El acero...?".
   * El prompt lo pide así porque es la convención natural del tipo en el CMS. */
  correctAnswer: z.boolean(),
});

export const preguntaRellenarEspacioSchema = z.object({
  ...camposComunes,
  tipo: z.literal("RELLENAR_ESPACIO"),
  /** Variantes que califican como correctas. Se comparan ignorando
   * mayúsculas, tildes y signos (`normalizarRespuestaCorta`,
   * src/lib/examenes/calificar.ts), así que "APU" y "apu" son la MISMA
   * variante — el modelo no necesita listar las dos. */
  acceptedAnswers: z
    .array(z.string().trim().min(1).max(200))
    .min(1)
    .max(MAXIMO_RESPUESTAS_ACEPTADAS_GENERADAS),
});

const parGeneradoSchema = z.object({
  left: z.string().trim().min(1).max(200),
  right: z.string().trim().min(1).max(200),
});

export const preguntaEmparejarSchema = z.object({
  ...camposComunes,
  tipo: z.literal("EMPAREJAR"),
  /** `question` es la INSTRUCCIÓN del emparejamiento ("Relaciona cada
   * herramienta con su función"), no una afirmación ni una pregunta cerrada:
   * el estudiante ve dos columnas, no un enunciado con opciones. */
  pairs: z
    .array(parGeneradoSchema)
    .min(MINIMO_PARES_EMPAREJAR_GENERADOS)
    .max(MAXIMO_PARES_EMPAREJAR_GENERADOS)
    .refine(
      (pares) => new Set(pares.map((par) => par.left.trim().toLowerCase())).size === pares.length,
      "Elementos repetidos en la columna izquierda.",
    )
    .refine(
      (pares) => new Set(pares.map((par) => par.right.trim().toLowerCase())).size === pares.length,
      "Elementos repetidos en la columna derecha.",
    ),
});

export const preguntaGeneradaSchema = z.discriminatedUnion("tipo", [
  preguntaOpcionUnicaSchema,
  preguntaOpcionMultipleSchema,
  preguntaVerdaderoFalsoSchema,
  preguntaRellenarEspacioSchema,
  preguntaEmparejarSchema,
]);

export type GeneratedQuestion = z.infer<typeof preguntaGeneradaSchema>;

/** La respuesta completa. Un objeto con `questions` y no un array pelado: la
 * salida estructurada de Gemini exige un schema de objeto en la raíz. */
export const respuestaGeneracionSchema = z.object({
  questions: z.array(preguntaGeneradaSchema),
});

/**
 * El MISMO contrato, escrito en el dialecto de Gemini (`responseSchema`, un
 * subconjunto de OpenAPI 3.0) — una rama de `anyOf` por tipo, en vez de un
 * solo `OBJECT` con propiedades opcionales.
 *
 * NO se derivan una de otra, aunque `z.toJSONSchema()` exista en Zod 4:
 * `responseSchema` de Gemini solo admite una lista corta de palabras clave
 * —`type`, `items`, `properties`, `required`, `enum`, `anyOf`,
 * `minItems`/`maxItems`, `minimum`/`maximum`…— que NO incluye
 * `minLength`/`maxLength`, y estos schemas los usan en casi todos los campos.
 * Convertir automáticamente produciría un schema con propiedades que el
 * servidor ignora o rechaza, y el fallo aparecería como un 400 opaco.
 *
 * `anyOf` (y no discriminar por `enum` de una sola forma) es lo que permite
 * que cada rama tenga SUS PROPIOS campos obligatorios: sin esto, un `OBJECT`
 * único tendría que declarar `options`, `correctAnswerIndex`,
 * `correctAnswerIndices`, `correctAnswer`, `acceptedAnswers` y `pairs` como
 * opcionales a la vez, y nada le impediría al modelo mezclar campos de dos
 * tipos en la misma pregunta.
 *
 * La división del trabajo entre los dos esquemas es la que importa:
 *
 *   ESQUEMA_RESPUESTA_GEMINI  fuerza la FORMA de cada rama (el modelo no
 *                             puede devolver otra cosa; es una garantía del
 *                             decodificador).
 *   respuestaGeneracionSchema valida el CONTENIDO (longitudes, rangos, que
 *                             los índices apunten a una opción real, que no
 *                             se repitan los pares).
 *
 * Que el segundo sea más estricto es correcto y deliberado: la forma la
 * garantiza el servidor, los límites de negocio los seguimos comprobando
 * nosotros. `tipos.test.ts` verifica que las dos enumeren los mismos campos
 * por rama, para que agregar uno al schema de Zod y olvidarlo acá falle en CI
 * y no en producción — mismo criterio que `DISPARADORES_GENERACION` contra su
 * CHECK.
 */
const descripcionVideoId = "El videoId EXACTO, copiado literal, del video al que pertenece la pregunta.";
const descripcionFragmento =
  `Frase TEXTUAL de máximo ${MAXIMO_PALABRAS_FRAGMENTO} palabras, copiada literal de la ` +
  "transcripción de ESE video. Se verifica automáticamente contra la transcripción: " +
  "si no aparece tal cual, la pregunta se descarta.";

const esquemaOpcionUnica = {
  type: "OBJECT",
  properties: {
    tipo: { type: "STRING", enum: ["OPCION_UNICA"] },
    videoId: { type: "STRING", description: descripcionVideoId },
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
      description: "Índice (base 0) de la ÚNICA opción correcta dentro de `options`.",
    },
    sourceFragment: { type: "STRING", description: descripcionFragmento },
  },
  required: ["tipo", "videoId", "question", "options", "correctAnswerIndex", "sourceFragment"],
  propertyOrdering: ["tipo", "videoId", "question", "options", "correctAnswerIndex", "sourceFragment"],
} as const;

const esquemaOpcionMultiple = {
  type: "OBJECT",
  properties: {
    tipo: { type: "STRING", enum: ["OPCION_MULTIPLE"] },
    videoId: { type: "STRING", description: descripcionVideoId },
    question: { type: "STRING", description: "El enunciado de la pregunta, dejando claro que hay varias correctas." },
    options: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: OPCIONES_POR_PREGUNTA,
      maxItems: OPCIONES_POR_PREGUNTA,
      description: `Exactamente ${OPCIONES_POR_PREGUNTA} opciones.`,
    },
    correctAnswerIndices: {
      type: "ARRAY",
      items: { type: "INTEGER", minimum: 0, maximum: OPCIONES_POR_PREGUNTA - 1 },
      minItems: MINIMO_CORRECTAS_OPCION_MULTIPLE,
      maxItems: OPCIONES_POR_PREGUNTA - 1,
      description:
        `Índices (base 0) de TODAS las opciones correctas: al menos ${MINIMO_CORRECTAS_OPCION_MULTIPLE} y ` +
        "nunca todas las opciones.",
    },
    sourceFragment: { type: "STRING", description: descripcionFragmento },
  },
  required: ["tipo", "videoId", "question", "options", "correctAnswerIndices", "sourceFragment"],
  propertyOrdering: ["tipo", "videoId", "question", "options", "correctAnswerIndices", "sourceFragment"],
} as const;

const esquemaVerdaderoFalso = {
  type: "OBJECT",
  properties: {
    tipo: { type: "STRING", enum: ["VERDADERO_FALSO"] },
    videoId: { type: "STRING", description: descripcionVideoId },
    question: {
      type: "STRING",
      description: "Una AFIRMACIÓN (no una pregunta) que el estudiante califica como verdadera o falsa.",
    },
    correctAnswer: { type: "BOOLEAN", description: "true si la afirmación es verdadera, false si es falsa." },
    sourceFragment: { type: "STRING", description: descripcionFragmento },
  },
  required: ["tipo", "videoId", "question", "correctAnswer", "sourceFragment"],
  propertyOrdering: ["tipo", "videoId", "question", "correctAnswer", "sourceFragment"],
} as const;

const esquemaRellenarEspacio = {
  type: "OBJECT",
  properties: {
    tipo: { type: "STRING", enum: ["RELLENAR_ESPACIO"] },
    videoId: { type: "STRING", description: descripcionVideoId },
    question: {
      type: "STRING",
      description: "Pregunta con respuesta corta y objetiva (un término, una cifra, un nombre).",
    },
    acceptedAnswers: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: 1,
      maxItems: MAXIMO_RESPUESTAS_ACEPTADAS_GENERADAS,
      description: "Variantes válidas de la respuesta (por ejemplo una sigla y su forma completa).",
    },
    sourceFragment: { type: "STRING", description: descripcionFragmento },
  },
  required: ["tipo", "videoId", "question", "acceptedAnswers", "sourceFragment"],
  propertyOrdering: ["tipo", "videoId", "question", "acceptedAnswers", "sourceFragment"],
} as const;

const esquemaEmparejar = {
  type: "OBJECT",
  properties: {
    tipo: { type: "STRING", enum: ["EMPAREJAR"] },
    videoId: { type: "STRING", description: descripcionVideoId },
    question: {
      type: "STRING",
      description: "La INSTRUCCIÓN del emparejamiento (ej. «Relaciona cada término con su definición»).",
    },
    pairs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          left: { type: "STRING" },
          right: { type: "STRING" },
        },
        required: ["left", "right"],
        propertyOrdering: ["left", "right"],
      },
      minItems: MINIMO_PARES_EMPAREJAR_GENERADOS,
      maxItems: MAXIMO_PARES_EMPAREJAR_GENERADOS,
      description: "Pares elemento-pareja, sin repetir texto en ninguna de las dos columnas.",
    },
    sourceFragment: { type: "STRING", description: descripcionFragmento },
  },
  required: ["tipo", "videoId", "question", "pairs", "sourceFragment"],
  propertyOrdering: ["tipo", "videoId", "question", "pairs", "sourceFragment"],
} as const;

export const ESQUEMAS_POR_TIPO = {
  OPCION_UNICA: esquemaOpcionUnica,
  OPCION_MULTIPLE: esquemaOpcionMultiple,
  VERDADERO_FALSO: esquemaVerdaderoFalso,
  RELLENAR_ESPACIO: esquemaRellenarEspacio,
  EMPAREJAR: esquemaEmparejar,
} as const satisfies Record<TipoPreguntaImplementado, unknown>;

export const ESQUEMA_RESPUESTA_GEMINI = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        anyOf: Object.values(ESQUEMAS_POR_TIPO),
      },
    },
  },
  required: ["questions"],
} as const;

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

/**
 * Estado de un trabajo de generación, tal como lo sondea la pantalla.
 *
 * Vive aquí y no en `trabajo.ts` —que es quien lo produce— porque este módulo
 * no importa nada de servidor (solo zod) y aquel importa el cliente con
 * service role y el de Gemini. Un componente "use client" puede leer de aquí
 * sin riesgo de arrastrarlos al navegador. Ver el comentario del reexport en
 * `trabajo.ts`.
 */
export type EstadoTrabajoGeneracion = {
  trabajoId: string;
  estado: "PENDIENTE" | "COMPLETADO" | "FALLIDO";
  preguntasValidadas: number;
  preguntasRecibidas: number;
  /** Títulos de los videos que no aportaron ni una pregunta validada. */
  videosSinPreguntas: string[];
  error: string | null;
  creadoEn: string;
  finalizadoEn: string | null;
};
