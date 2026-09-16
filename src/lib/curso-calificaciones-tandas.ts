import type { CalificacionCurso } from "@/lib/curso-calificaciones";

/**
 * Cómo junta la ficha del curso las tandas de reseñas ("Ver más reseñas",
 * AUDIT-2026-09-15.md P2-10). Funciones puras, fuera del componente, para
 * poder probarlas sin navegador.
 *
 * Solo tipos desde curso-calificaciones.ts: ese módulo importa el cliente de
 * Supabase del servidor y no puede entrar al bundle del navegador.
 */

export type ReseñasAdicionales = { reseñas: CalificacionCurso[]; hayMas: boolean } | null;

/**
 * Lo que se pinta: la primera tanda (del servidor) seguida de las traídas
 * después, sin repetidas y sin las que se moderaron en esta visita.
 *
 * Repetidas: la paginación es por desplazamiento, así que una reseña
 * publicada entre dos clics corre la lista y la siguiente tanda trae otra
 * vez la última que ya se veía. Se conserva la primera aparición.
 */
export function reseñasVisibles(
  primeraTanda: readonly CalificacionCurso[],
  adicionales: ReseñasAdicionales,
  ocultas: ReadonlySet<string>,
): CalificacionCurso[] {
  const vistas = new Set<string>();
  return [...primeraTanda, ...(adicionales?.reseñas ?? [])].filter((reseña) => {
    if (vistas.has(reseña.id) || ocultas.has(reseña.id)) return false;
    vistas.add(reseña.id);
    return true;
  });
}

/**
 * Desde dónde pedir la siguiente tanda: cuántas filas devolvió ya el
 * servidor, NO cuántas se ven. Descartar repetidas u ocultar moderadas no
 * mueve la posición en la base; contar las visibles haría pedir otra vez una
 * tanda ya traída.
 */
export function desdeSiguienteTanda(primeraTanda: readonly CalificacionCurso[], adicionales: ReseñasAdicionales): number {
  return primeraTanda.length + (adicionales?.reseñas.length ?? 0);
}

/** Si mostrar "Ver más reseñas": lo dice la última tanda que llegó. */
export function quedanMasReseñas(hayMasPrimeraTanda: boolean, adicionales: ReseñasAdicionales): boolean {
  return adicionales ? adicionales.hayMas : hayMasPrimeraTanda;
}

/** Agrega una tanda recién traída a las anteriores. */
export function agregarTanda(adicionales: ReseñasAdicionales, tanda: { reseñas: CalificacionCurso[]; hayMas: boolean }) {
  return { reseñas: [...(adicionales?.reseñas ?? []), ...tanda.reseñas], hayMas: tanda.hayMas };
}
