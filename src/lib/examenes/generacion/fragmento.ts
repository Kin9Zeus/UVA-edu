import { MAXIMO_PALABRAS_FRAGMENTO } from "./tipos";

/**
 * Normaliza para comparar: sin tildes, sin mayúsculas, sin puntuación y sin
 * espacios.
 *
 * Es la misma técnica que `normalizarRespuestaCorta()`
 * (src/lib/examenes/calificar.ts) y por el mismo motivo: comparar texto que
 * pasó por dos máquinas distintas sin que una coma de diferencia cuente como
 * desacuerdo. Acá el problema es peor que en una respuesta corta, porque el
 * texto viene de un WebVTT: Mux parte las frases en cues de dos líneas, así
 * que la transcripción tiene saltos de línea EN MEDIO de las oraciones que
 * el modelo cita seguidas.
 *
 * Borrar también los espacios es lo que resuelve ese caso — y sí, hace que
 * «la casa» y «lacasa» se consideren iguales. Es un falso positivo
 * teóricamente posible y prácticamente irrelevante: el fragmento tiene que
 * aparecer entero, y una cadena de 20 palabras que coincide sin espacios
 * coincide.
 */
export function normalizarParaComparar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Palabras "de verdad" del fragmento, para el tope de longitud. */
function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export type ResultadoValidacionFragmento =
  | { valido: true }
  /**
   * `motivo` es para el log del administrador, no para el estudiante — esta
   * pregunta nunca llega a un examen.
   */
  | { valido: false; motivo: "vacio" | "demasiado_largo" | "no_aparece" };

/**
 * ¿El fragmento citado aparece de verdad en ESTA transcripción?
 *
 * Es la única defensa contra la falla que hace inservible a un generador de
 * exámenes: una pregunta perfectamente redactada, plausible, sobre algo que
 * el profesor nunca dijo. Un estudiante que estudió el curso la falla, y no
 * hay forma de distinguirla de una buena leyéndola.
 *
 * ⚠️ `transcript` tiene que ser la transcripción del video de
 * `question.videoId`, NO la concatenación de todas las del curso. Con todo
 * concatenado, la validación pasa a comprobar "esto se dijo en algún momento
 * del curso", que es precisamente el error que el prompt le pide al modelo no
 * cometer: una pregunta del video 3 anclada a una frase del video 7 valida, y
 * el estudiante la ve mientras repasa el video 3. Quien llama es responsable
 * de buscar la transcripción correcta — ver `validarPreguntasGeneradas()`.
 *
 * El tope de palabras no es cosmético. Sin él, un "fragmento" que fuera la
 * transcripción entera validaría siempre y esta función dejaría de comprobar
 * nada.
 */
export function validateFragment(
  fragment: string,
  transcript: string,
): ResultadoValidacionFragmento {
  const fragmentoNormalizado = normalizarParaComparar(fragment);

  // Un fragmento que se queda en nada tras normalizar (solo signos, solo
  // espacios) sería subcadena de cualquier transcripción: `"".includes()` es
  // siempre true. Se rechaza antes de llegar a la comparación.
  if (fragmentoNormalizado === "") {
    return { valido: false, motivo: "vacio" };
  }

  if (contarPalabras(fragment) > MAXIMO_PALABRAS_FRAGMENTO) {
    return { valido: false, motivo: "demasiado_largo" };
  }

  if (!normalizarParaComparar(transcript).includes(fragmentoNormalizado)) {
    return { valido: false, motivo: "no_aparece" };
  }

  return { valido: true };
}
