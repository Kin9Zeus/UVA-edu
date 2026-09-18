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

/** Los tipos "cerrados" que la app califica sola, sin intervención humana.
 * Son los que se pueden RENDIR: una pregunta ya guardada de cualquiera de
 * estos cinco se muestra y se califica con normalidad, aunque ya no todos se
 * puedan CREAR nuevos (ver `TIPOS_CREABLES`, más abajo). */
export const TIPOS_IMPLEMENTADOS = [
  "OPCION_UNICA",
  "OPCION_MULTIPLE",
  "VERDADERO_FALSO",
  "RELLENAR_ESPACIO",
  "EMPAREJAR",
] as const;

export type TipoPreguntaImplementado = (typeof TIPOS_IMPLEMENTADOS)[number];

/**
 * Subconjunto de `TIPOS_IMPLEMENTADOS` que se puede CREAR nuevo — a mano
 * desde el CMS (botones "Agregar:" de `ExamenTab.tsx`) o generado por IA
 * (`src/lib/examenes/generacion/tipos.ts`).
 *
 * OPCION_MULTIPLE y RELLENAR_ESPACIO se retiraron de aquí por decisión de
 * producto: la app sigue mostrando y calificando con normalidad las preguntas
 * de esos dos tipos que ya existían antes del cambio (por eso siguen en
 * `TIPOS_IMPLEMENTADOS`), pero nadie —ni un admin a mano ni la IA— puede
 * crear una pregunta nueva de esos tipos. `crearPregunta`
 * (src/actions/admin/examenes.ts) es quien hace cumplir esto en el servidor;
 * `esTipoCreable` es el único lugar que sabe cuáles son.
 */
export const TIPOS_CREABLES = ["OPCION_UNICA", "VERDADERO_FALSO", "EMPAREJAR"] as const;

export type TipoPreguntaCreable = (typeof TIPOS_CREABLES)[number];

export function esTipoCreable(tipo: string): tipo is TipoPreguntaCreable {
  return (TIPOS_CREABLES as readonly string[]).includes(tipo);
}

/**
 * Declarados en el enum de Postgres pero todavía sin UI ni calificación —
 * ORDENAR_PASOS y RESPUESTA_ABIERTA. Ver docs/development-plan.md,
 * "Exámenes — Fase 2".
 *
 * Existe como constante y no solo como comentario para que este archivo sea
 * el único sitio que hay que tocar al habilitarlos: mover el valor de una
 * lista a la otra y escribir su caso en `calificarPregunta` — igual que se
 * hizo para EMPAREJAR.
 */
export const TIPOS_FASE_2 = ["ORDENAR_PASOS", "RESPUESTA_ABIERTA"] as const;

export type TipoPregunta = TipoPreguntaImplementado | (typeof TIPOS_FASE_2)[number];

export function esTipoImplementado(tipo: string): tipo is TipoPreguntaImplementado {
  return (TIPOS_IMPLEMENTADOS as readonly string[]).includes(tipo);
}

export const ETIQUETA_TIPO: Record<TipoPreguntaImplementado, string> = {
  OPCION_UNICA: "Opción única",
  OPCION_MULTIPLE: "Opción múltiple",
  VERDADERO_FALSO: "Verdadero o falso",
  RELLENAR_ESPACIO: "Respuesta corta",
  EMPAREJAR: "Relacionar",
};

/** Ayuda contextual del selector de tipo en el CMS. */
export const DESCRIPCION_TIPO: Record<TipoPreguntaImplementado, string> = {
  OPCION_UNICA: "Varias opciones, una sola correcta.",
  OPCION_MULTIPLE: "Varias correctas. Solo puntúa si el estudiante las marca todas y ninguna incorrecta.",
  VERDADERO_FALSO: "Afirmación que el estudiante califica como verdadera o falsa.",
  RELLENAR_ESPACIO: "El estudiante escribe la respuesta. Se compara ignorando mayúsculas, tildes y signos.",
  EMPAREJAR: "El estudiante empareja cada elemento de la izquierda con su pareja correcta de la derecha.",
};

// ------------------------------------------------------------
// Límites
// ------------------------------------------------------------

/**
 * Piso histórico de `examenes.nota_aprobatoria`. La columna sigue existiendo
 * (DEFAULT 75 + CHECK `>= 75`), pero YA NO DECIDE NADA: aprobar un examen
 * dejó de ser "sacar X%" y pasó a ser "responder correctamente todas las
 * preguntas antes de quedarse sin vidas" (ver `ProgresoIntento` más abajo).
 * Esta constante queda solo para documentar ese CHECK desde el código; ningún
 * formulario la pide ni ninguna regla la compara.
 */
export const NOTA_APROBATORIA_MINIMA = 75;
export const MAXIMO_PREGUNTAS_POR_EXAMEN = 100;
export const MAXIMO_OPCIONES_POR_PREGUNTA = 8;
/** Tope de pares en una pregunta EMPAREJAR. Mismo orden de magnitud que
 * `MAXIMO_OPCIONES_POR_PREGUNTA`: más que esto y emparejar deja de ser una
 * pregunta rápida. */
export const MAXIMO_PARES_EMPAREJAR = 8;
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

/**
 * Vidas con las que arranca cada intento (mecánica tipo Platzi). Fija para
 * toda la plataforma por decisión de producto — a propósito NO es un campo
 * de `examenes` ni algo que configure el admin. Cada respuesta incorrecta
 * resta una; al llegar a 0 el intento se cierra YA como REPROBADO (ver
 * `responderPregunta`, src/actions/examenes/intento.ts).
 *
 * No se persiste ninguna columna "vidas_restantes": se derivan de
 * `ProgresoIntento.fallos` con `calcularVidasRestantes`
 * (src/lib/examenes/calificar.ts), que es la única fuente de verdad.
 */
export const VIDAS_INICIALES = 5;

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

/**
 * Un par de la pregunta EMPAREJAR, tal como lo guarda el admin. El mismo
 * `id` ata la izquierda con su derecha correcta.
 *
 * ¡OJO! Este `id` NUNCA debe viajar como el id del elemento de la DERECHA
 * que ve el estudiante: a diferencia de `OpcionPregunta.correcta` (que sí se
 * despoja al proyectar), acá el problema no es un campo de más, es que el
 * propio identificador ES la respuesta — si `izquierdas` y `derechas`
 * comparten el mismo `id` para el mismo par, cualquiera que lea el HTML
 * (o React DevTools) empareja por id sin leer el enunciado. Por eso
 * `congelarPreguntas` genera un id ofuscado por INTENTO para cada elemento
 * de la derecha (`ParEmparejarCongelado.idMostrado`) y solo ese viaja al
 * navegador — ver `prepararPreguntasParaEstudiante`.
 */
export type ParEmparejar = { id: string; izquierda: string; derecha: string };

/** `ParEmparejar` congelado en un intento, con el id que de verdad se le
 * muestra al estudiante para el elemento de la derecha — distinto de `id`
 * (que sigue siendo la llave real del par, nunca expuesta como tal). */
export type ParEmparejarCongelado = ParEmparejar & { idMostrado: string };

const parEmparejarSchema = z.object({
  id: z.string().min(1).max(64),
  izquierda: z.string().trim().min(1, "Un par no puede quedar vacío.").max(200, "El texto es demasiado largo."),
  derecha: z.string().trim().min(1, "Un par no puede quedar vacío.").max(200, "El texto es demasiado largo."),
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
  /** `OpcionPregunta[]` para los tipos de opciones, `ParEmparejar[]` para
   * EMPAREJAR, `null` para RELLENAR_ESPACIO. Misma columna JSONB
   * (`preguntas_examen.opciones`), forma distinta según `tipo`. */
  opciones: OpcionPregunta[] | ParEmparejar[] | null;
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
    opciones: z
      .array(z.union([opcionSchema, parEmparejarSchema]))
      .max(Math.max(MAXIMO_OPCIONES_POR_PREGUNTA, MAXIMO_PARES_EMPAREJAR), "Demasiadas opciones.")
      .nullable(),
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

    if (pregunta.tipo === "EMPAREJAR") {
      // El union de arriba (opcionSchema | parEmparejarSchema) NO garantiza
      // que cada elemento tenga la forma de ParEmparejar: un array de
      // OpcionPregunta (con `correcta`, sin `izquierda`/`derecha`) también
      // matchea el union entero por el lado de `opcionSchema`, así que se
      // valida la forma acá explícitamente en vez de confiar en cuál rama
      // del union coincidió.
      const pares = (pregunta.opciones ?? []) as Partial<ParEmparejar>[];
      if (pares.length < 2) {
        agregar("Un emparejamiento necesita al menos dos pares.");
        return;
      }
      if (pares.some((par) => !par.izquierda?.trim() || !par.derecha?.trim())) {
        agregar("Hay pares sin completar.");
        return;
      }
      if (new Set(pares.map((par) => par.id)).size !== pares.length) {
        agregar("Hay pares con el mismo identificador.");
      }
      // Dos tarjetas de la derecha con el mismo texto son indistinguibles
      // para el estudiante: elija cualquiera, la mitad de las veces no va a
      // coincidir por id aunque haya entendido bien la relación — una
      // pregunta injusta, no difícil. Mismo problema (más leve) si se repite
      // en la izquierda.
      const derechas = pares.map((par) => par.derecha!.trim().toLowerCase());
      if (new Set(derechas).size !== derechas.length) {
        agregar("Hay elementos repetidos en la columna derecha.");
      }
      const izquierdas = pares.map((par) => par.izquierda!.trim().toLowerCase());
      if (new Set(izquierdas).size !== izquierdas.length) {
        agregar("Hay elementos repetidos en la columna izquierda.");
      }
      return;
    }

    const opciones = (pregunta.opciones ?? []) as OpcionPregunta[];
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
  // Sin `notaAprobatoria`: el examen ya no se aprueba por porcentaje, así que
  // el formulario del admin dejó de pedirlo y la columna
  // `examenes.nota_aprobatoria` se queda con su DEFAULT sin que nadie la
  // escriba (ver NOTA_APROBATORIA_MINIMA).
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
  /**
   * Solo tipo EMPAREJAR: los mismos pares, en DOS barajados independientes
   * (uno por columna, SIEMPRE barajados sin importar `aleatorizarOpciones` —
   * a diferencia de una lista de opciones plana, dejar las dos columnas en
   * el mismo orden relativo ES la respuesta, no una decisión legítima del
   * admin). `paresDerecha` es `ParEmparejarCongelado`: cada elemento lleva
   * además `idMostrado`, un id opaco por INTENTO que reemplaza a `id` al
   * proyectar hacia el estudiante — ver el comentario de `ParEmparejar`.
   * `null` para el resto de tipos.
   */
  paresIzquierda: ParEmparejar[] | null;
  paresDerecha: ParEmparejarCongelado[] | null;
};

/** Lo que sí viaja al navegador: sin `correcta`, sin `respuestasAceptadas`, y
 * sin la correspondencia real entre `izquierdas` y `derechas` — el `id` de
 * cada elemento de `derechas` es `idMostrado` (opaco, por intento), nunca la
 * llave real del par. */
export type PreguntaParaEstudiante = {
  id: string;
  tipo: TipoPreguntaImplementado;
  enunciado: DocumentoContenido;
  puntos: number;
  opciones: { id: string; texto: string }[] | null;
  izquierdas: { id: string; texto: string }[] | null;
  derechas: { id: string; texto: string }[] | null;
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
    izquierdas:
      pregunta.paresIzquierda?.map((par) => ({ id: par.id, texto: par.izquierda })) ?? null,
    // `idMostrado`, NUNCA `par.id`: `par.id` es la llave real del par (la
    // respuesta correcta), y `izquierdas` de arriba también usa `par.id`
    // como su propio id — si acá se repitiera el mismo valor, emparejar por
    // id idéntico entre las dos columnas resolvería la pregunta sin leer el
    // enunciado (ver el comentario de `ParEmparejar`).
    derechas:
      pregunta.paresDerecha?.map((par) => ({ id: par.idMostrado, texto: par.derecha })) ?? null,
  }));
}

// ------------------------------------------------------------
// Respuestas del estudiante
// ------------------------------------------------------------

/**
 * `string` para OPCION_UNICA / VERDADERO_FALSO (id de la opción elegida) y
 * para RELLENAR_ESPACIO (el texto escrito).
 * `string[]` para OPCION_MULTIPLE (ids de las opciones marcadas).
 * `Record<string,string>` para EMPAREJAR: mapea el id de cada elemento de la
 * izquierda al id del elemento de la derecha con el que lo emparejó el
 * estudiante (ver `ParEmparejar` — el mismo id sirve de llave en ambos
 * lados, así que la respuesta correcta es `mapa[par.id] === par.id`).
 */
export type RespuestaEstudiante = string | string[] | Record<string, string>;

/** Indexadas por id de pregunta. Una pregunta sin entrada es una pregunta sin
 * responder — no es lo mismo que responderla mal, pero puntúa igual (0). */
export type RespuestasIntento = Record<string, RespuestaEstudiante>;

/**
 * Lo que de verdad vive hoy en `intentos_examen.respuestas` (JSONB, sin CHECK
 * de forma: la convención es de esta capa, no de Postgres).
 *
 * Antes era un `RespuestasIntento` plano porque cada pregunta se respondía una
 * sola vez. Con la cola de reintentos ya no alcanza: fallar una pregunta no
 * la saca del examen, la manda al final de la fila, así que hay que llevar
 * aparte cuántas vidas se gastaron (una respuesta incorrecta ya no deja
 * rastro si después se acierta) y en qué orden quedan las pendientes.
 *
 * Reglas de cierre, las únicas dos que existen:
 *   · `cola.length === 0`  → APROBADO (respondió bien TODAS las preguntas).
 *   · vidas en 0           → REPROBADO YA, sin importar qué quede en `cola`.
 * No hay criterio por porcentaje: `puntaje_pct` se sigue escribiendo porque la
 * columna es NOT NULL con CHECK de rango, pero es informativo.
 */
export type ProgresoIntento = {
  /** Preguntas ya resueltas CORRECTAMENTE, con su respuesta final. Mismo
   * shape que el viejo contenido plano de la columna, así que
   * `calificarPregunta`/`construirRevision`/`getResultadoIntento` siguen
   * funcionando tal cual si se les pasa esto. */
  resueltas: RespuestasIntento;
  /** Respuestas incorrectas acumuladas en TODO el intento — una por cada
   * fallo, aunque sea la misma pregunta reintentada. Es de donde salen las
   * vidas (`calcularVidasRestantes`). */
  fallos: number;
  /** Ids de las preguntas pendientes, EN EL ORDEN en que se presentan.
   * `cola[0]` es la pregunta actual. Al acertar se saca del frente; al fallar
   * se saca del frente y se empuja al FINAL, para que vuelva a aparecer
   * después de las demás pendientes y nunca dos veces seguidas. */
  cola: string[];
};

/**
 * Lee la columna `respuestas` como `ProgresoIntento`.
 *
 * El fallback no es un caso esperado (todo intento se crea con la forma nueva
 * desde `iniciarIntento`/`otorgarIntentoExtra`): es lo que evita que una fila
 * con otra forma reviente con `undefined.cola` en plena rendición. Reconstruye
 * lo mínimo razonable — sin nada resuelto, sin fallos y con la cola en el
 * orden congelado — en vez de inventar un progreso que no ocurrió.
 */
export function parsearProgreso(valor: unknown, preguntas: PreguntaCongelada[]): ProgresoIntento {
  const colaInicial = preguntas.map((pregunta) => pregunta.id);
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return { resueltas: {}, fallos: 0, cola: colaInicial };
  }

  const crudo = valor as Partial<ProgresoIntento>;
  const resueltas =
    crudo.resueltas && typeof crudo.resueltas === "object" && !Array.isArray(crudo.resueltas)
      ? (crudo.resueltas as RespuestasIntento)
      : {};
  const cola = Array.isArray(crudo.cola)
    ? crudo.cola.filter((id): id is string => typeof id === "string")
    : colaInicial.filter((id) => !Object.hasOwn(resueltas, id));

  return {
    resueltas,
    fallos: typeof crudo.fallos === "number" && crudo.fallos >= 0 ? crudo.fallos : 0,
    cola,
  };
}

/** Forma de una sola respuesta (la de UNA pregunta), lo que valida
 * `responderPregunta` para la pregunta actual. */
export const respuestaEstudianteSchema = z.union([
  z.string().max(500),
  z.array(z.string().max(64)).max(MAXIMO_OPCIONES_POR_PREGUNTA),
  z
    .record(z.string().max(64), z.string().max(64))
    .refine((mapa) => Object.keys(mapa).length <= MAXIMO_PARES_EMPAREJAR, "Demasiados pares."),
]);
