import type {
  PreguntaCongelada,
  RespuestaEstudiante,
  RespuestasIntento,
} from "@/lib/examenes/tipos";

/**
 * Calificación de un intento de examen. Funciones puras, sin base de datos ni
 * sesión: son la regla de negocio que decide si alguien aprueba un curso, así
 * que se prueban solas (calificar.test.ts) en vez de solo a través de la
 * Server Action que las llama.
 *
 * Corre SIEMPRE en el servidor. El navegador no recibe las respuestas
 * correctas (ver `prepararPreguntasParaEstudiante`), así que no podría
 * calificar aunque quisiera — y el puntaje que llegara desde el cliente no se
 * mira nunca.
 */

/**
 * "V-Ray 6.0" y "vray 6.0" deben contar como la misma respuesta.
 *
 * Descarta diacríticos (NFD + rango de marcas combinantes, mismo truco que
 * `slugificar` en src/lib/slug.ts), pasa a minúsculas y elimina TODO lo que no
 * sea letra o dígito — espacios y signos incluidos. Por eso "3ds max",
 * "3dsmax" y "3DS-Max" colapsan al mismo valor.
 *
 * Es deliberadamente permisivo: en una respuesta corta el error que importa es
 * conceptual, no ortográfico, y el costo de un falso negativo (reprobar a
 * quien sabía) es mucho más alto que el de un falso positivo. Cuando eso no
 * alcanza, el admin puede listar varias respuestas aceptadas para la misma
 * pregunta.
 *
 * Contrapartida conocida: colapsa también respuestas que solo se distinguen
 * por separación ("un aire" / "unaire"). Para una respuesta de una o dos
 * palabras —el uso real de este tipo— no se ha encontrado un caso donde eso
 * acepte una respuesta genuinamente incorrecta.
 */
export function normalizarRespuestaCorta(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Ids marcados, sin duplicados y en orden estable, para comparar conjuntos. */
function conjuntoDeIds(valor: RespuestaEstudiante | undefined): string[] {
  if (valor === undefined) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return [...new Set(lista.filter((id) => typeof id === "string" && id !== ""))].sort();
}

/**
 * ¿Está bien respondida esta pregunta?
 *
 * OPCION_MULTIPLE se califica todo-o-nada (el conjunto marcado debe ser
 * exactamente el conjunto correcto). Es la regla más simple de explicarle al
 * estudiante antes de rendir, y la única que no premia marcar todas las
 * opciones para arañar puntos parciales. El precio es que no distingue entre
 * fallar por poco y no tener idea; se acepta a cambio de que el criterio sea
 * predecible.
 */
export function calificarPregunta(
  pregunta: PreguntaCongelada,
  respuesta: RespuestaEstudiante | undefined,
): boolean {
  if (pregunta.tipo === "RELLENAR_ESPACIO") {
    if (typeof respuesta !== "string") return false;
    const normalizada = normalizarRespuestaCorta(respuesta);
    // Una respuesta que se queda en nada tras normalizar (espacios, signos)
    // es una pregunta sin responder, no un acierto — aunque el admin hubiera
    // guardado por error una variante aceptada igual de vacía.
    if (normalizada === "") return false;
    return pregunta.respuestasAceptadas.some(
      (aceptada) => normalizarRespuestaCorta(aceptada) === normalizada,
    );
  }

  const correctas = (pregunta.opciones ?? [])
    .filter((opcion) => opcion.correcta)
    .map((opcion) => opcion.id)
    .sort();

  // Pregunta sin ninguna opción correcta: no debería existir (la validación de
  // `preguntaEntradaSchema` la rechaza al guardar), pero si se colara no puede
  // darse por acertada por coincidencia de dos conjuntos vacíos.
  if (correctas.length === 0) return false;

  const marcadas = conjuntoDeIds(respuesta);
  if (marcadas.length !== correctas.length) return false;
  return marcadas.every((id, indice) => id === correctas[indice]);
}

export type ResultadoIntento = {
  /** 0-100, redondeado a dos decimales (la columna es DECIMAL(5,2)). */
  puntajePct: number;
  puntosObtenidos: number;
  puntosPosibles: number;
  aprobado: boolean;
  /** Ids de las preguntas falladas o sin responder, para el detalle del
   * resultado. No incluye cuál era la respuesta correcta: mientras al
   * estudiante le queden intentos, eso le entregaría el examen. */
  preguntasFalladas: string[];
};

export function calificarIntento(
  preguntas: PreguntaCongelada[],
  respuestas: RespuestasIntento,
  notaRequerida: number,
): ResultadoIntento {
  let puntosObtenidos = 0;
  let puntosPosibles = 0;
  const preguntasFalladas: string[] = [];

  for (const pregunta of preguntas) {
    puntosPosibles += pregunta.puntos;
    if (calificarPregunta(pregunta, respuestas[pregunta.id])) {
      puntosObtenidos += pregunta.puntos;
    } else {
      preguntasFalladas.push(pregunta.id);
    }
  }

  // Un examen sin preguntas no se aprueba por división vacía. La app impide
  // publicar un examen así (`motivosParaNoPublicarExamen`), pero el intento
  // podría haber quedado congelado antes de que se borrara la última.
  const puntajePct =
    puntosPosibles > 0 ? Math.round((puntosObtenidos / puntosPosibles) * 10000) / 100 : 0;

  return {
    puntajePct,
    puntosObtenidos,
    puntosPosibles,
    aprobado: puntosPosibles > 0 && puntajePct >= notaRequerida,
    preguntasFalladas,
  };
}

/**
 * Baraja una copia (Fisher-Yates). `Math.random` y no un CSPRNG a propósito:
 * esto solo decide en qué orden ve alguien sus preguntas — subir el costo de
 * copiarse entre estudiantes, no proteger un secreto. Predecir el orden no da
 * ninguna ventaja porque el contenido no depende de él.
 */
export function barajar<T>(items: readonly T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
