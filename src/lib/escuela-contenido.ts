/**
 * Contenido propio de la página de cada escuela (`/catalogo/[categoriaSlug]`):
 * una introducción y de 0 a 5 preguntas frecuentes. SEO fase 14, tarea
 * «páginas de escuela como landings». El texto lo redacta el equipo de
 * contenido desde /admin/categorias; aquí solo se valida y se normaliza.
 *
 * Funciones puras: las usan la Server Action (al guardar) y la página (al
 * leer). La lectura es defensiva: un JSON con otra forma en la base no rompe
 * la página, se descarta lo que no sirve.
 */

export type PreguntaFrecuente = { pregunta: string; respuesta: string };

export type ContenidoEscuela = {
  introduccion: string | null;
  preguntas: PreguntaFrecuente[];
};

export const MAX_PREGUNTAS = 5;
export const MAX_CARACTERES_INTRODUCCION = 3000;
export const MAX_CARACTERES_PREGUNTA = 200;
export const MAX_CARACTERES_RESPUESTA = 1200;
/** Lo que pide la tarea; el admin lo muestra como guía, no lo exige. */
export const PALABRAS_SUGERIDAS = { minimo: 150, maximo: 300 } as const;

export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** Párrafos separados por una o más líneas en blanco, sin vacíos. */
export function parrafos(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Lo guardado en `preguntas_frecuentes`, con lo inválido descartado. */
export function leerPreguntas(valor: unknown): PreguntaFrecuente[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((p): p is PreguntaFrecuente => {
      if (typeof p !== "object" || p === null) return false;
      const { pregunta, respuesta } = p as Record<string, unknown>;
      return typeof pregunta === "string" && typeof respuesta === "string" && pregunta.trim() !== "" && respuesta.trim() !== "";
    })
    .map(({ pregunta, respuesta }) => ({ pregunta: pregunta.trim(), respuesta: respuesta.trim() }))
    .slice(0, MAX_PREGUNTAS);
}

export type EntradaContenido = { introduccion: string; preguntas: PreguntaFrecuente[] };

/**
 * Valida lo que manda el admin. Una fila con la pregunta y la respuesta
 * vacías se descarta (el editor deja filas en blanco); con solo una de las dos
 * es un error: se perdería la otra mitad sin avisar.
 */
export function validarContenidoEscuela(
  entrada: EntradaContenido,
): { ok: true; valor: { introduccion: string | null; preguntas: PreguntaFrecuente[] } } | { ok: false; error: string } {
  const introduccion = entrada.introduccion.replace(/\r\n?/g, "\n").trim();
  if (introduccion.length > MAX_CARACTERES_INTRODUCCION) {
    return { ok: false, error: `La introducción no puede pasar de ${MAX_CARACTERES_INTRODUCCION} caracteres.` };
  }

  const preguntas: PreguntaFrecuente[] = [];
  for (const [i, fila] of entrada.preguntas.entries()) {
    const pregunta = fila.pregunta.trim();
    const respuesta = fila.respuesta.trim();
    if (!pregunta && !respuesta) continue;
    if (!pregunta || !respuesta) {
      return { ok: false, error: `A la pregunta ${i + 1} le falta ${pregunta ? "la respuesta" : "la pregunta"}.` };
    }
    if (pregunta.length > MAX_CARACTERES_PREGUNTA) {
      return { ok: false, error: `La pregunta ${i + 1} no puede pasar de ${MAX_CARACTERES_PREGUNTA} caracteres.` };
    }
    if (respuesta.length > MAX_CARACTERES_RESPUESTA) {
      return { ok: false, error: `La respuesta ${i + 1} no puede pasar de ${MAX_CARACTERES_RESPUESTA} caracteres.` };
    }
    preguntas.push({ pregunta, respuesta });
  }
  if (preguntas.length > MAX_PREGUNTAS) {
    return { ok: false, error: `Máximo ${MAX_PREGUNTAS} preguntas frecuentes.` };
  }

  return { ok: true, valor: { introduccion: introduccion || null, preguntas } };
}
