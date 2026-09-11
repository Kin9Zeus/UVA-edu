import { ApiError, GoogleGenAI, type HttpRetryOptions } from "@google/genai";
import { configuracionGemini, ESPERA_MAXIMA_S } from "./configuracion";

/**
 * Cliente de la API de Gemini, usado por el pipeline de generación de exámenes
 * (src/lib/examenes/generacion/).
 *
 * Inicialización perezosa, a diferencia de `src/lib/stripe/client.ts` y
 * `src/lib/mux/client.ts`, que construyen en el ámbito del módulo. La razón es
 * la misma que justifica `createAdminClient()`: este módulo lo importa código
 * que también contiene funciones puras (armar el prompt, validar el
 * fragmento), y construir al importar haría que un entorno sin
 * `GEMINI_API_KEY` —CI corriendo los tests unitarios, un build de una rama sin
 * la variable— fallara al CARGAR el archivo en vez de al usarlo.
 *
 * La clave se lee y se pasa explícita en vez de dejar que el SDK la tome del
 * entorno por su cuenta: así el fallo por variable ausente es este mensaje, en
 * español y señalando qué falta, y no un error de autenticación de la API
 * varios segundos más tarde.
 *
 * No se cachea el cliente entre llamadas a propósito. Construirlo es armar un
 * objeto con su transporte HTTP —nada de sockets ni handshakes— y la
 * generación de un examen ocurre como mucho unas pocas veces por curso.
 * Guardarlo en un módulo compartido solo agregaría estado global que sobrevive
 * a un cambio de variables de entorno.
 *
 * Los números de tiempo, reintentos y modelos ya no están acá: los decide
 * `configuracionGemini()`, que los lee del entorno y comprueba que sigan
 * siendo compatibles con el barredor de trabajos atascados.
 */
export function crearClienteGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY. La generación de exámenes con IA no puede funcionar sin ella.",
    );
  }

  const { tiempoLimiteMs, intentosPorModelo, esperaBaseMs } = configuracionGemini();

  /**
   * Reintentos ante fallos transitorios de la API, CONTRA EL MISMO MODELO.
   *
   * No es precaución teórica: la primera prueba real contra Gemini devolvió
   * `503 UNAVAILABLE — "This model is currently experiencing high demand"` dos
   * veces seguidas, y un minuto después el mismo modelo respondía en 5s.
   *
   * Se configuran explícitamente en vez de confiar en los del SDK porque su
   * documentación dice que los códigos reintentables "may be used" por defecto
   * (`HttpRetryOptions`, @google/genai) — y en la práctica aquel 503 volvió de
   * inmediato, sin reintentar. Ambigüedad que no conviene heredar en el camino
   * que decide si un curso tiene examen.
   *
   * Por defecto `attempts` es 1, o sea: ningún reintento acá. Con la cadena de
   * modelos, insistirle al mismo modelo saturado es la peor forma de gastar el
   * presupuesto — ese trabajo lo hace `generateCourseExam()` pasando al
   * siguiente modelo. Esta opción sigue existiendo para quien suba
   * `GEMINI_ATTEMPTS_PER_MODEL` a sabiendas.
   */
  const reintentos: HttpRetryOptions = {
    attempts: intentosPorModelo,
    // El SDK espera segundos («in fractions of a second», HttpRetryOptions);
    // la variable se llama _MS y se guarda en ms. La división es acá, en el
    // único punto que toca el SDK, y no repartida por el resto del código.
    initialDelay: esperaBaseMs / 1000,
    maxDelay: ESPERA_MAXIMA_S,
    expBase: 2,
    // 408 timeout, 429 rate limit, 5xx del servicio. Explícitos para que un
    // cambio de defaults del SDK no altere en silencio qué se reintenta.
    httpStatusCodes: [...CODIGOS_TRANSITORIOS],
  };

  return new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: tiempoLimiteMs, retryOptions: reintentos },
  });
}

/**
 * Códigos HTTP que significan "el servicio no pudo ahora", no "la petición
 * está mal".
 *
 * La distinción es la que decide si vale la pena probar con otro modelo. Ante
 * un 400 (esquema inválido) o un 401 (clave mala), el siguiente modelo de la
 * cadena fallaría idéntico: cambiar solo gastaría el presupuesto entero para
 * llegar al mismo sitio, y varios minutos más tarde.
 */
const CODIGOS_TRANSITORIOS = [408, 429, 500, 502, 503, 504] as const;

/**
 * ¿Merece la pena reintentar esto con otro modelo?
 *
 * Cubre dos formas distintas del mismo problema:
 *
 *   - `ApiError` con código transitorio: el servidor contestó que no puede.
 *   - Aborto: el servidor NO contestó y el timeout cortó la espera. El SDK lo
 *     propaga como un error de aborto del fetch, sin `status`, así que hay que
 *     reconocerlo por nombre. Es el caso más frecuente cuando un modelo está
 *     saturado —fue exactamente el síntoma del cuelgue en producción— y
 *     dejarlo fuera vaciaría de sentido la cadena.
 */
export function esErrorTransitorio(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (CODIGOS_TRANSITORIOS as readonly number[]).includes(error.status);
  }

  if (error instanceof Error) {
    // `AbortError` (DOMException) y el `TimeoutError` que usan algunas
    // implementaciones de fetch. Se mira el nombre y no el mensaje porque el
    // mensaje cambia entre runtimes y está en inglés.
    if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  }

  return false;
}
