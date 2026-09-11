import { z } from "zod";
import { contenidoLeccionSchema, type DocumentoContenido } from "@/lib/editor/tipos";

/**
 * Formas y validación de los exámenes finales (docs/functional-spec.md
 * Flujo 12). Módulo sin "use server": lo importan Server Actions, componentes
 * cliente y los tests, igual que src/lib/editor/tipos.ts.
 *
 * Nada de lo que hay acá toca la base de datos — es el contrato entre las
 * tres representaciones de una pregunta:
 *
 *   PreguntaCompleta      lo que el admin edita y guarda      (con respuestas)
 *   PreguntaCongelada     copia dentro del intento             (con respuestas)
 *   PreguntaParaEstudiante lo que viaja al navegador           (SIN respuestas)
 *
 * La única función que produce la tercera a partir de la segunda es
 * `prepararPreguntasParaEstudiante()`. Si alguna vez el estudiante recibe una
 * pregunta por otro camino, el examen viaja resuelto a su navegador.
 */

// ------------------------------------------------------------
// Tipos de pregunta
// ------------------------------------------------------------

/** Los cuatro tipos "cerrados" que la app califica sola, sin intervención
 * humana. Son los únicos que la v1 acepta crear y rendir. */
export const TIPOS_IMPLEMENTADOS = [
  "OPCION_UNICA",
  "OPCION_MULTIPLE",
  "VERDADERO_FALSO",
  "RELLENAR_ESPACIO",
] as const;

export type TipoPreguntaImplementado = (typeof TIPOS_IMPLEMENTADOS)[number];

/**
 * Declarados en el enum de Postgres pero todavía sin UI ni calificación —
 * ORDENAR_PASOS, EMPAREJAR y RESPUESTA_ABIERTA. Ver
 * docs/development-plan.md, "Exámenes — Fase 2".
 *
 * Existe como constante y no solo como comentario para que este archivo sea
 * el único sitio que hay que tocar al habilitarlos: mover el valor de una
 * lista a la otra y escribir su caso en `calificarPregunta`.
 */
export const TIPOS_FASE_2 = ["ORDENAR_PASOS", "EMPAREJAR", "RESPUESTA_ABIERTA"] as const;

export type TipoPregunta = TipoPreguntaImplementado | (typeof TIPOS_FASE_2)[number];

export function esTipoImplementado(tipo: string): tipo is TipoPreguntaImplementado {
  return (TIPOS_IMPLEMENTADOS as readonly string[]).includes(tipo);
}

export const ETIQUETA_TIPO: Record<TipoPreguntaImplementado, string> = {
  OPCION_UNICA: "Opción única",
  OPCION_MULTIPLE: "Opción múltiple",
  VERDADERO_FALSO: "Verdadero o falso",
  RELLENAR_ESPACIO: "Respuesta corta",
};

/** Ayuda contextual del selector de tipo en el CMS. */
export const DESCRIPCION_TIPO: Record<TipoPreguntaImplementado, string> = {
  OPCION_UNICA: "Varias opciones, una sola correcta.",
  OPCION_MULTIPLE: "Varias correctas. Solo puntúa si el estudiante las marca todas y ninguna incorrecta.",
  VERDADERO_FALSO: "Afirmación que el estudiante califica como verdadera o falsa.",
  RELLENAR_ESPACIO: "El estudiante escribe la respuesta. Se compara ignorando mayúsculas, tildes y signos.",
};

// ------------------------------------------------------------
// Límites
// ------------------------------------------------------------

export const NOTA_APROBATORIA_MINIMA = 75;
export const MAXIMO_PREGUNTAS_POR_EXAMEN = 100;
export const MAXIMO_OPCIONES_POR_PREGUNTA = 8;
export const MINUTOS_LIMITE_MAXIMO = 1440;
/** Espera entre un intento fallido y el siguiente DENTRO de la misma tanda
 * (ronda) de intentos. Constante de aplicación y no columna: si algún día
 * hace falta configurarlo por examen se agrega `cooldown_minutos` sin romper
 * nada. */
export const COOLDOWN_REINTENTO_MINUTOS = 15;

/**
 * Espera al AGOTAR una tanda completa de `intentos_maximos` sin aprobar.
 *
 * `intentos_maximos` no es un tope de por vida — es el tamaño de una ronda.
 * Al agotar una ronda, la espera pasa de `COOLDOWN_REINTENTO_MINUTOS` a esta
 * (5 horas), y al cumplirse se habilita una ronda nueva, indefinidamente sin
 * intervención de un admin. Ver `calcularDisponibilidad` en src/lib/examen.ts
 * — es la única función que decide esto, para que la Server Action que
 * inicia el intento y la pantalla que muestra la cuenta regresiva nunca
 * diverjan.
 */
export const COOLDOWN_AGOTADO_HORAS = 5;
/** Margen que se le concede al reloj del cliente al validar el corte por
 * tiempo: cubre la latencia entre que el navegador dispara el auto-envío y
 * el servidor lo recibe. Sin esto, un envío automático legítimo disparado
 * justo en el segundo 0 llegaría "tarde" y se calificaría con lo que hubiera. */
export const TOLERANCIA_TIEMPO_SEGUNDOS = 30;

// ------------------------------------------------------------
// Opciones
// ------------------------------------------------------------

export type OpcionPregunta = {
  /** Estable dentro de la pregunta: es lo que el estudiante manda como
   * respuesta y lo que se congela en el intento. Se genera con crypto.randomUUID()
   * al crear la opción y no cambia al editar su texto. */
  id: string;
  texto: string;
  correcta: boolean;
};

const opcionSchema = z.object({
  id: z.string().min(1).max(64),
  texto: z.string().trim().min(1, "Una opción no puede quedar vacía.").max(500, "La opción es demasiado larga."),
  correcta: z.boolean(),
});

// ------------------------------------------------------------
// Pregunta (lo que el admin guarda)
// ------------------------------------------------------------

export type PreguntaCompleta = {
  id: string;
  tipo: TipoPreguntaImplementado;
  enunciado: DocumentoContenido;
  puntos: number;
  orden: number;
  opciones: OpcionPregunta[] | null;
  respuestasAceptadas: string[];
  explicacion: DocumentoContenido | null;
  /**
   * Procedencia de la pregunta. Los tres campos van juntos porque describen
   * una sola cosa: de dónde salió y cuánto hay que fiarse.
   *
   * `origen === null` es una pregunta escrita a mano por un administrador —el
   * caso de todas las que existían antes de la generación con IA— y no lleva
   * ninguna insignia: es lo normal, no un estado.
   *
   * Con origen, `validada` distingue lo único que importa al revisarla: si el
   * fragmento citado se encontró LITERALMENTE en la transcripción de ese
   * video (`true`) o no (`false`). Es un booleano nullable y no un
   * `@default(false)` justamente para que "escrita a mano" no se confunda con
   * "generada y no verificada".
   */
  origen: OrigenPregunta | null;
};

/** De qué video salió una pregunta generada, y con qué cita. */
export type OrigenPregunta = {
  leccionId: string;
  /** Título de la lección de origen; `null` si la lección se borró después
   *  (el FK es ON DELETE SET NULL, así que esto es alcanzable). */
  leccionTitulo: string | null;
  /** La frase de la transcripción en la que se apoya la pregunta. */
  fragmento: string | null;
  /** ¿El fragmento se encontró literalmente en esa transcripción? */
  validada: boolean | null;
};

/**
 * Valida la forma de una pregunta según su tipo. No es un `z.object` plano
 * porque las reglas dependen del tipo: una de opción única con dos correctas,
 * o una de respuesta corta sin ninguna respuesta aceptada, son preguntas
 * imposibles de aprobar — y el formulario no es la última línea de defensa
 * (la Server Action es un endpoint invocable directamente).
 */
export const preguntaEntradaSchema = z
  .object({
    tipo: z.enum(TIPOS_IMPLEMENTADOS, "Tipo de pregunta no válido."),
    enunciado: contenidoLeccionSchema,
    puntos: z
      .number()
      .int("Los puntos deben ser un número entero.")
      .min(1, "Una pregunta debe valer al menos 1 punto.")
      .max(100, "Una pregunta no puede valer más de 100 puntos."),
    opciones: z.array(opcionSchema).max(MAXIMO_OPCIONES_POR_PREGUNTA, "Demasiadas opciones.").nullable(),
    respuestasAceptadas: z
      .array(z.string().trim().min(1).max(200))
      .max(20, "Demasiadas respuestas aceptadas.")
      .default([]),
    explicacion: contenidoLeccionSchema.nullable().default(null),
  })
  .superRefine((pregunta, ctx) => {
    const agregar = (message: string) => ctx.addIssue({ code: "custom", message });

    if (pregunta.tipo === "RELLENAR_ESPACIO") {
      if (pregunta.respuestasAceptadas.length === 0) {
        agregar("Escribe al menos una respuesta aceptada para la pregunta de respuesta corta.");
      }
      // Dos variantes que normalizan igual ("V-Ray" y "vray") no son un error
      // del admin, pero sí ruido: se deduplican al guardar, no acá.
      return;
    }

    const opciones = pregunta.opciones ?? [];
    if (opciones.length < 2) {
      agregar("Una pregunta de opciones necesita al menos dos.");
      return;
    }

    if (new Set(opciones.map((opcion) => opcion.id)).size !== opciones.length) {
      agregar("Hay opciones con el mismo identificador.");
    }

    const correctas = opciones.filter((opcion) => opcion.correcta).length;

    if (pregunta.tipo === "OPCION_UNICA" || pregunta.tipo === "VERDADERO_FALSO") {
      if (correctas !== 1) {
        agregar(
          pregunta.tipo === "VERDADERO_FALSO"
            ? "Marca si la afirmación es verdadera o falsa."
            : "Marca exactamente una opción correcta.",
        );
      }
    }

    if (pregunta.tipo === "VERDADERO_FALSO" && opciones.length !== 2) {
      agregar("Una pregunta de verdadero o falso tiene exactamente dos opciones.");
    }

    if (pregunta.tipo === "OPCION_MULTIPLE") {
      if (correctas === 0) {
        agregar("Marca al menos una opción correcta.");
      }
      // Todas correctas no es "difícil", es una pregunta sin discriminación:
      // se aprueba marcando todo sin leer el enunciado.
      if (correctas === opciones.length) {
        agregar("No todas las opciones pueden ser correctas.");
      }
    }
  });

export type PreguntaEntrada = z.infer<typeof preguntaEntradaSchema>;

export const examenConfiguracionSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "El examen necesita un título.")
    .max(200, "El título es demasiado largo."),
  instrucciones: contenidoLeccionSchema.nullable().default(null),
  notaAprobatoria: z
    .number()
    .int("La nota debe ser un número entero.")
    .min(NOTA_APROBATORIA_MINIMA, `La nota mínima para aprobar no puede bajar de ${NOTA_APROBATORIA_MINIMA}%.`)
    .max(100, "La nota no puede superar 100%."),
  intentosMaximos: z
    .number()
    .int("Los intentos deben ser un número entero.")
    .min(1, "Debe permitirse al menos un intento.")
    .max(20, "Demasiados intentos permitidos.")
    .nullable(),
  minutosLimite: z
    .number()
    .int("Los minutos deben ser un número entero.")
    .min(1, "El límite de tiempo debe ser de al menos un minuto.")
    .max(MINUTOS_LIMITE_MAXIMO, "El límite de tiempo es demasiado alto.")
    .nullable(),
  aleatorizarPreguntas: z.boolean(),
  aleatorizarOpciones: z.boolean(),
});

// ------------------------------------------------------------
// Pregunta congelada dentro del intento
// ------------------------------------------------------------

/**
 * Copia de la pregunta tal como se le presentó a ESE estudiante en ESE
 * intento, ya aleatorizada. Incluye las respuestas correctas: es lo que
 * permite calificar sin volver a leer `preguntas_examen`, que el admin pudo
 * haber editado, reordenado o borrado mientras el intento estaba abierto.
 *
 * Vive en `intentos_examen.preguntas_congeladas` y NUNCA sale del servidor
 * en esta forma.
 */
export type PreguntaCongelada = {
  id: string;
  tipo: TipoPreguntaImplementado;
  enunciado: DocumentoContenido;
  puntos: number;
  opciones: OpcionPregunta[] | null;
  respuestasAceptadas: string[];
};

/** Lo que sí viaja al navegador: sin `correcta` y sin `respuestasAceptadas`. */
export type PreguntaParaEstudiante = {
  id: string;
  tipo: TipoPreguntaImplementado;
  enunciado: DocumentoContenido;
  puntos: number;
  opciones: { id: string; texto: string }[] | null;
};

/**
 * El único puente entre la forma con respuestas y la forma pública.
 *
 * Reconstruye el objeto campo por campo en vez de hacer `delete` sobre una
 * copia: así, si mañana `PreguntaCongelada` gana un campo sensible, este
 * proyector no lo arrastra por omisión — hay que agregarlo a mano para que
 * salga.
 */
export function prepararPreguntasParaEstudiante(
  preguntas: PreguntaCongelada[],
): PreguntaParaEstudiante[] {
  return preguntas.map((pregunta) => ({
    id: pregunta.id,
    tipo: pregunta.tipo,
    enunciado: pregunta.enunciado,
    puntos: pregunta.puntos,
    opciones:
      pregunta.opciones?.map((opcion) => ({ id: opcion.id, texto: opcion.texto })) ?? null,
  }));
}

// ------------------------------------------------------------
// Respuestas del estudiante
// ------------------------------------------------------------

/**
 * `string` para OPCION_UNICA / VERDADERO_FALSO (id de la opción elegida) y
 * para RELLENAR_ESPACIO (el texto escrito).
 * `string[]` para OPCION_MULTIPLE (ids de las opciones marcadas).
 */
export type RespuestaEstudiante = string | string[];

/** Indexadas por id de pregunta. Una pregunta sin entrada es una pregunta sin
 * responder — no es lo mismo que responderla mal, pero puntúa igual (0). */
export type RespuestasIntento = Record<string, RespuestaEstudiante>;

export const respuestasIntentoSchema = z.record(
  z.string().uuid(),
  z.union([z.string().max(500), z.array(z.string().max(64)).max(MAXIMO_OPCIONES_POR_PREGUNTA)]),
);
