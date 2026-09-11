/**
 * Configuración operativa del pipeline de IA, leída del entorno.
 *
 * QUÉ VIVE ACÁ Y QUÉ NO
 * ---------------------
 * Acá están los parámetros que cambian CUÁNTO se espera y CONTRA QUÉ MODELO se
 * habla — decisiones operativas, de las que se toman cuando Google satura una
 * cola un domingo y hay que reaccionar sin abrir el repositorio.
 *
 * No está el prompt del sistema: ese vive en `examenes/generacion/prompt.ts`,
 * que es su capa (este módulo no sabe qué es un examen). Tiene su propio
 * override con su propia guarda, por el mismo razonamiento.
 *
 * Todos los valores tienen un valor por defecto que ES el que se venía usando
 * como constante. Un despliegue sin ninguna variable definida se comporta
 * igual que antes de que este archivo existiera; las variables son un override
 * consciente, no un requisito.
 *
 * POR QUÉ SE VALIDA PEREZOSAMENTE Y NO AL IMPORTAR
 * ------------------------------------------------
 * Mismo motivo que `crearClienteGemini()`: a este módulo lo alcanza código que
 * también contiene funciones puras, y validar al CARGAR haría que un
 * `next build` en una rama sin variables, o los tests unitarios en CI,
 * murieran al importar el archivo en vez de al usarlo. La validación corre en
 * la primera generación real y se memoriza.
 */

/**
 * Cadena de modelos, en orden de preferencia.
 *
 * Es una CADENA y no un modelo suelto porque los reintentos iban todos al
 * mismo modelo: si ese modelo está congestionado, todos fallan igual. Es
 * literalmente lo que pasó — dos días de generaciones muertas por `503
 * UNAVAILABLE` y `504 DEADLINE_EXCEEDED` contra `gemini-3.8-flash`, mientras
 * `gemini-3.6-flash` respondía en 3,2s en el mismo instante.
 *
 * Con la cadena, el mismo presupuesto de tiempo se reparte entre modelos
 * DISTINTOS en vez de repetirse contra la misma cola. Basta con que uno
 * responda.
 *
 * El orden es a propósito: primero el más nuevo. Si su cola se descongestiona
 * —o si la clave pasa a facturación, que es la hipótesis no demostrada de por
 * qué fallaba— se aprovecha solo, sin cambiar nada. Si sigue saturado, se cae
 * a 3.6 y nadie se entera.
 *
 * Medido el 10-sep-2026 con la MISMA petición, en paralelo, con clave de nivel
 * gratuito:
 *
 *   gemini-3.8-flash        504 a los 39,4s
 *   gemini-3.7-flash        503 a los  2,4s
 *   gemini-3.6-flash        OK  en    3,2s   cita literal correcta
 *   gemini-3.5-flash        OK  en    9,1s   cita literal correcta
 *   gemini-3.5-flash-lite   OK  en    1,2s   cita literal correcta
 *   gemini-2.5-flash        404 (aparece en models.list() pero no es invocable)
 *
 * Los tres por defecto comparten el mismo millón de tokens de entrada, así que
 * caer al siguiente no recorta el contexto: un curso largo cabe igual en
 * cualquiera de ellos.
 */
const MODELOS_POR_DEFECTO = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];

/**
 * Tiempo máximo por intento. NO es opcional: sin él, el SDK espera para
 * siempre.
 *
 * Se descubrió en producción. Un administrador pulsó "Generar examen", el
 * trabajo se registró bien y se quedó en PENDIENTE indefinidamente, sin error
 * en Sentry ni nada que mirar. La API no respondía y, como no había límite,
 * `after()` se quedó colgado reteniendo el cerrojo del curso. Ese cerrojo es
 * un índice parcial único, así que un trabajo colgado bloquea TODAS las
 * generaciones futuras de ese curso hasta que alguien corra el barredor.
 *
 * ES UN TECHO PARA CAZAR CUELGUES, NO UN PRESUPUESTO DE TRABAJO. La prueba de
 * humo lo dejó claro: una corrida tardó 193,6s en total, pero el trabajo de
 * verdad fueron ~11s — el primer intento se colgó, el límite lo cortó y el
 * siguiente respondió enseguida. Una generación sana es cuestión de segundos;
 * cuando pasa de un minuto no está trabajando, no va a contestar.
 *
 * Generoso —5 min— y no ajustado porque un curso de 40 videos manda muchas
 * transcripciones de una vez y el modelo razona antes de responder
 * (`thinkingBudget: -1`); apretarlo convertiría un curso grande en un fallo
 * permanente. Lo que NO puede ser es infinito.
 */
const TIEMPO_LIMITE_MS_POR_DEFECTO = 300_000;

/**
 * Intentos contra CADA modelo antes de pasar al siguiente de la cadena.
 *
 * 1 y no 3: con la cadena, reintentar el mismo modelo es la peor forma de
 * gastar el presupuesto. Un 503 de un modelo saturado no se arregla
 * repitiéndolo dos segundos después; se arregla preguntándole a otro. Subirlo
 * multiplica el peor caso por cada modelo — ver `validaPresupuesto()`.
 */
const INTENTOS_POR_MODELO_POR_DEFECTO = 1;

/**
 * Espera inicial entre reintentos contra el MISMO modelo, en milisegundos;
 * crece exponencialmente (2s → 4s → 8s …) hasta `ESPERA_MAXIMA_S`.
 *
 * En milisegundos porque así se llama la variable, aunque el SDK la reciba en
 * segundos («in fractions of a second», HttpRetryOptions): la conversión se
 * hace en `crearClienteGemini()`. Vale más una unidad explícita en el nombre
 * que ahorrarse una división.
 *
 * Con `GEMINI_ATTEMPTS_PER_MODEL = 1` no se usa nunca. Existe para que subir
 * los intentos siga siendo seguro sin tener que tocar código.
 */
const ESPERA_BASE_MS_POR_DEFECTO = 2_000;

/** Techo de la espera exponencial. Constante y no variable: acotarla es lo que
 * hace que el peor caso sea calculable, así que no debe poder moverse desde el
 * entorno. */
export const ESPERA_MAXIMA_S = 30;

/**
 * Determinismo relativo: es un examen calificable, no texto creativo.
 * Regenerar el mismo curso no debería producir preguntas radicalmente
 * distintas cada vez.
 *
 */
const TEMPERATURA_POR_DEFECTO = 0.3;

/**
 * `top_p` no tiene valor por defecto: si `GEMINI_TOP_P` no está definida, no se
 * manda el parámetro y el modelo usa el suyo.
 *
 * Se deja sin poner —en vez de fijarlo en algo— porque Google recomienda
 * ajustar temperatura O top-p, no ambas: son dos formas de acotar lo mismo, y
 * moviendo las dos a la vez ya no se sabe cuál causó qué. Queda disponible por
 * si hace falta, con la advertencia escrita al lado.
 */
const TOP_P_POR_DEFECTO = null;

/**
 * Latencia a partir de la cual una generación se considera lenta.
 *
 * NO corta nada — para eso está `GEMINI_TIMEOUT_MS`. Es un objetivo: si una
 * corrida lo supera, queda registrada en Sentry aunque haya terminado bien.
 *
 * Sirve para ver la degradación ANTES de que se convierta en un timeout. Una
 * cola que se satura no pasa de 3s a fallar de golpe: primero pasa a 40s
 * durante unos días. Sin esta señal, esa fase intermedia es invisible y el
 * primer aviso es un examen que no se generó.
 *
 * 60s: por encima de un minuto, la medición dice que el modelo no está
 * trabajando, está encolado.
 */
const LATENCIA_OBJETIVO_MS_POR_DEFECTO = 60_000;

/**
 * Techo de tokens de salida.
 *
 * El riesgo acá es quedarse CORTO, no pasarse: con salida estructurada, un
 * JSON truncado no es una pregunta menos, es la corrida entera perdida porque
 * el objeto no cierra. Y solo se paga lo que se usa, así que un techo alto no
 * cuesta nada mientras la respuesta sea normal.
 *
 * 64 000 es el máximo de salida de los modelos de la cadena. Estaba en 32 000
 * —la mitad de lo disponible— sin ninguna razón para dejar ese margen sin usar.
 */
const MAX_TOKENS_SALIDA_POR_DEFECTO = 64_000;

/**
 * Cuánto puede tardar una generación legítima antes de que el barredor la dé
 * por muerta. Ver `scripts/examenes-liberar-generaciones-atascadas.ts`.
 *
 * Se declara acá, y no allá, porque forma un par con el presupuesto de tiempo:
 * son dos números que solo son correctos EN RELACIÓN al otro, y tenerlos en
 * archivos distintos es justo lo que permite que se desincronicen. El script
 * lo importa de este módulo.
 */
const UMBRAL_ATASCADA_MINUTOS_POR_DEFECTO = 20;

/** 25% de holgura exigida por encima del peor caso teórico. */
const MARGEN_MINIMO = 0.25;

export interface ConfiguracionGemini {
  modelos: string[];
  tiempoLimiteMs: number;
  intentosPorModelo: number;
  esperaBaseMs: number;
  temperatura: number;
  topP: number | null;
  maxTokensSalida: number;
  latenciaObjetivoMs: number;
  umbralAtascadaMinutos: number;
}

/**
 * Suma de las esperas de backoff contra un solo modelo: 2 + 4 + 8 … acotadas
 * por `ESPERA_MAXIMA_S`. Con 1 intento no hay ninguna espera, así que da 0.
 */
function esperasTotalesMs(intentos: number, baseMs: number): number {
  let total = 0;
  for (let i = 0; i < intentos - 1; i += 1) {
    total += Math.min(baseMs * 2 ** i, ESPERA_MAXIMA_S * 1000);
  }
  return total;
}

/**
 * Peor caso de una generación: la cadena entera agotada, cada modelo
 * consumiendo todos sus intentos y cada intento llegando al límite de tiempo.
 */
export function peorCasoMs(config: ConfiguracionGemini): number {
  const porModelo =
    config.intentosPorModelo * config.tiempoLimiteMs +
    esperasTotalesMs(config.intentosPorModelo, config.esperaBaseMs);
  return config.modelos.length * porModelo;
}

/**
 * LA INVARIANTE DEL PIPELINE.
 *
 * El barredor marca FALLIDO todo trabajo que lleve más de
 * `umbralAtascadaMinutos` sin terminar, y eso SUELTA EL CERROJO del curso. Si
 * una generación puede tardar más que ese umbral, el barredor la mata estando
 * viva, otra corrida entra por el cerrojo liberado, y la primera —que sigue
 * corriendo— acaba escribiendo encima de un trabajo ya cerrado. Corrupción
 * silenciosa, sin excepción y sin nada en Sentry.
 *
 * Antes, los dos números eran constantes en archivos distintos y la relación
 * entre ellos solo existía en un comentario. Ahora los dos se pueden mover
 * desde el entorno —de hecho el umbral YA se podía— y por eso la relación
 * tiene que comprobarse en vez de confiarse.
 *
 * Se exige margen: llegar justo al umbral significa que cualquier demora de
 * red la pone del lado malo.
 */
function validaPresupuesto(config: ConfiguracionGemini): void {
  const peorCaso = peorCasoMs(config);
  const umbralMs = config.umbralAtascadaMinutos * 60_000;
  const conMargen = peorCaso * (1 + MARGEN_MINIMO);

  if (conMargen >= umbralMs) {
    const minutos = (ms: number) => (ms / 60_000).toFixed(1);
    throw new Error(
      `Configuración de IA incoherente: una generación puede tardar hasta ${minutos(peorCaso)} min ` +
        `(${config.modelos.length} modelo(s) × ${config.intentosPorModelo} intento(s) × ` +
        `${config.tiempoLimiteMs / 1000}s), y el barredor da por muertos los trabajos a los ` +
        `${config.umbralAtascadaMinutos} min. El barredor mataría generaciones vivas. ` +
        `Arréglalo de una de estas formas: ` +
        `sube GENERACION_ATASCADA_UMBRAL_MINUTOS por encima de ${Math.ceil(conMargen / 60_000)}; ` +
        `baja GEMINI_TIMEOUT_MS (ahora ${config.tiempoLimiteMs}); ` +
        `baja GEMINI_ATTEMPTS_PER_MODEL (ahora ${config.intentosPorModelo}); ` +
        `o quita modelos de GEMINI_MODELS (ahora ${config.modelos.length}).`,
    );
  }
}

function leerNumero(
  nombre: string,
  porDefecto: number,
  { min, max, entero }: { min: number; max: number; entero: boolean },
): number {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo.trim() === "") return porDefecto;

  const valor = Number(crudo);
  if (!Number.isFinite(valor)) {
    throw new Error(`${nombre} debe ser un número. Valor recibido: "${crudo}".`);
  }
  if (entero && !Number.isInteger(valor)) {
    throw new Error(`${nombre} debe ser un entero. Valor recibido: "${crudo}".`);
  }
  if (valor < min || valor > max) {
    throw new Error(`${nombre} debe estar entre ${min} y ${max}. Valor recibido: ${valor}.`);
  }
  return valor;
}

/** Como `leerNumero`, pero la ausencia de la variable significa "no lo mandes"
 * en vez de "usa este valor". */
function leerNumeroOpcional(
  nombre: string,
  porDefecto: number | null,
  { min, max }: { min: number; max: number },
): number | null {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo.trim() === "") return porDefecto;
  return leerNumero(nombre, Number(crudo), { min, max, entero: false });
}

function leerModelos(): string[] {
  const crudo = process.env.GEMINI_MODELS;
  if (crudo === undefined || crudo.trim() === "") return MODELOS_POR_DEFECTO;

  const modelos = crudo
    .split(",")
    .map((nombre) => nombre.trim())
    .filter((nombre) => nombre.length > 0);

  if (modelos.length === 0) {
    throw new Error(
      "GEMINI_MODELS no contiene ningún modelo. " +
        'Formato: "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash".',
    );
  }

  // Los alias móviles apuntan a otro modelo cuando Google lo decide. Un examen
  // que cambia de calidad sin un commit de por medio es exactamente lo que
  // este proyecto no quiere; si alguien los pone, que se entere de que no.
  const movil = modelos.find((nombre) => nombre.endsWith("-latest"));
  if (movil) {
    throw new Error(
      `GEMINI_MODELS no admite alias móviles ("${movil}"): apuntan a otro modelo cuando Google ` +
        "lo decide, y la calidad del examen cambiaría sin quedar registrada en git. Fija la versión.",
    );
  }

  return modelos;
}

let memoria: ConfiguracionGemini | null = null;

/**
 * Configuración validada del pipeline. Se calcula una vez y se memoriza: leer
 * y validar en cada llamada no aporta nada, y el proceso no cambia de entorno
 * a mitad de vida.
 */
export function configuracionGemini(): ConfiguracionGemini {
  if (memoria) return memoria;

  const config: ConfiguracionGemini = {
    modelos: leerModelos(),
    // De 10s (por debajo no le da tiempo ni a un curso mínimo) a 10 min.
    tiempoLimiteMs: leerNumero("GEMINI_TIMEOUT_MS", TIEMPO_LIMITE_MS_POR_DEFECTO, {
      min: 10_000,
      max: 600_000,
      entero: true,
    }),
    intentosPorModelo: leerNumero(
      "GEMINI_ATTEMPTS_PER_MODEL",
      INTENTOS_POR_MODELO_POR_DEFECTO,
      { min: 1, max: 5, entero: true },
    ),
    esperaBaseMs: leerNumero("GEMINI_RETRY_BASE_MS", ESPERA_BASE_MS_POR_DEFECTO, {
      min: 0,
      max: ESPERA_MAXIMA_S * 1000,
      entero: true,
    }),
    // Tope 1 y no 2 (el máximo que acepta la API): un examen calificable
    // generado con temperatura 1,5 no es una configuración que tenga sentido
    // permitir.
    temperatura: leerNumero("GEMINI_TEMPERATURE", TEMPERATURA_POR_DEFECTO, {
      min: 0,
      max: 1,
      entero: false,
    }),
    // Sin valor por defecto: `leerNumeroOpcional` devuelve null si la variable
    // no está, y entonces no se manda `topP` a la API.
    topP: leerNumeroOpcional("GEMINI_TOP_P", TOP_P_POR_DEFECTO, { min: 0, max: 1 }),
    // El piso de 1000 no es decorativo: por debajo, el JSON se trunca siempre
    // y la corrida se pierde entera. Vale más fallar acá con un mensaje claro.
    maxTokensSalida: leerNumero("GEMINI_MAX_OUTPUT_TOKENS", MAX_TOKENS_SALIDA_POR_DEFECTO, {
      min: 1_000,
      max: 64_000,
      entero: true,
    }),
    latenciaObjetivoMs: leerNumero(
      "GEMINI_TARGET_LATENCY_MS",
      LATENCIA_OBJETIVO_MS_POR_DEFECTO,
      { min: 1_000, max: 600_000, entero: true },
    ),
    umbralAtascadaMinutos: leerNumero(
      "GENERACION_ATASCADA_UMBRAL_MINUTOS",
      UMBRAL_ATASCADA_MINUTOS_POR_DEFECTO,
      { min: 1, max: 240, entero: true },
    ),
  };

  validaPresupuesto(config);

  memoria = config;
  return config;
}

/** Solo para los tests: olvida la configuración memorizada. */
export function _olvidaConfiguracionGemini(): void {
  memoria = null;
}
