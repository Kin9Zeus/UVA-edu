import { GoogleGenAI } from "@google/genai";

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
 * objeto con su transporte HTTP — nada de sockets ni handshakes— y la
 * generación de un examen ocurre como mucho unas pocas veces por curso.
 * Guardarlo en un módulo compartido solo agregaría estado global que sobrevive
 * a un cambio de variables de entorno.
 */
export function crearClienteGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY. La generación de exámenes con IA no puede funcionar sin ella.",
    );
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Modelo usado para generar preguntas.
 *
 * Constante y no variable de entorno: cambiar de modelo cambia la calidad y la
 * forma de las preguntas que llegan a un examen calificable, así que es una
 * decisión que debe pasar por revisión de código y quedar en el historial de
 * git — no algo que se pueda mover en caliente desde el panel de Railway sin
 * que nadie se entere.
 *
 * Tampoco se usan los alias móviles `gemini-pro-latest` / `gemini-flash-latest`
 * por el mismo motivo: apuntan a otro modelo cuando Google lo decide, y el
 * examen de un curso cambiaría de calidad sin ningún commit de por medio.
 *
 * `gemini-3.8-flash` es hoy el estable más reciente y el recomendado para
 * producción (ai.google.dev/gemini-api/docs/models). Verificar esa página al
 * actualizar: la familia 2.0 ya está retirada.
 */
export const MODELO_GENERACION_EXAMEN = "gemini-3.8-flash";
