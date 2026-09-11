import { revalidatePath } from "next/cache";

/**
 * Invalidación de las fichas de curso sin conocer su slug.
 *
 * Las fichas se direccionan por slug (/admin/cursos/<slug>, /cursos/<slug>),
 * pero casi todas las Server Actions del CMS solo reciben el `cursoId`.
 * `revalidatePath(`/admin/cursos/${cursoId}`)` era correcto mientras la URL
 * del panel llevaba el UUID; con slug es un no-op silencioso: invalida una
 * ruta que nadie visita y la ficha abierta sigue mostrando lo de antes. La
 * pública ya tenía ese problema desde que pasó a slug.
 *
 * Buscar el slug en cada acción sería una consulta más por mutación, y además
 * frágil: `actualizarInfoCurso` lo cambia en la misma operación. Por eso se
 * invalida el PATRÓN de la ruta, que cubre todas las fichas a la vez. Son
 * páginas dinámicas (leen la sesión), así que no hay una caché cara que
 * perder; lo que importa es que la vista abierta se refresque.
 *
 * El patrón lleva el grupo de rutas porque así etiqueta Next cada página
 * (`/(admin)/admin/cursos/[cursoSlug]/page` en app-paths-manifest.json) y
 * `revalidatePath` compara contra esa etiqueta, no contra la URL.
 */
export function revalidarCursoAdmin(): void {
  revalidatePath("/(admin)/admin/cursos/[cursoSlug]", "page");
}

/** Lo mismo para la ficha pública del curso. */
export function revalidarCursoPublico(): void {
  revalidatePath("/(public)/cursos/[cursoSlug]", "page");
}
