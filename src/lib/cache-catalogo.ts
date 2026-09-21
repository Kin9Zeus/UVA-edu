/**
 * Caché del catálogo público (Home, /catalogo, /catalogo/[categoria]) con
 * invalidación explícita desde el panel de administración.
 *
 * El porqué, medido en producción: Railway corre en US-West y Supabase en
 * US-East, así que cada consulta desde el servidor cuesta ~190 ms de ida y
 * vuelta (aislado con la caché de 30 s de `/api/health`: 374 ms con una
 * consulta contra 182 ms sin ninguna). `/catalogo` encadenaba cuatro — el
 * selector de categorías, las opciones del buscador, la búsqueda en sí y la
 * resolución de la categoría — para devolver un listado que cambia cuando un
 * administrador publica un curso, o sea unas pocas veces por semana. Eran
 * ~600 ms de servidor por visita para recalcular algo idéntico cada vez.
 *
 * Por qué se puede cachear sin mostrar datos viejos: todas estas funciones
 * leen con `createPublicClient()` (Anon Key, sin cookies), así que el
 * resultado es el mismo para cualquier visitante y no hay nada por usuario
 * que se pueda filtrar de una sesión a otra. La rama con progreso del
 * estudiante (`buscarCatalogoConProgreso`) es una función aparte a propósito
 * —ver el comentario de `buscarCatalogoConCliente` en lib/categoria.ts— y NO
 * se cachea nunca.
 *
 * Y por qué no se ve viejo: cada mutación del panel que puede cambiar lo que
 * ve un visitante llama a `revalidarCatalogoPublico()`, que vacía la etiqueta
 * con `{ expire: 0 }` — sin ventana de "servir rancio mientras refresco", de
 * modo que la siguiente petición espera al dato nuevo. El administrador que
 * acaba de publicar un curso lo ve publicado, no dentro de un minuto.
 *
 * `REVALIDAR_SEGUNDOS` es una red de seguridad, no el mecanismo principal: si
 * algún día se agrega una mutación nueva y se olvida llamar acá, el catálogo
 * se desfasa 5 minutos como mucho en vez de hasta el próximo despliegue.
 *
 * Nota de versión: `unstable_cache` está deprecado en Next 16 a favor de
 * `use cache`, que exige activar el flag `cacheComponents`. Esa migración
 * cambia el modelo de render de TODA la app (Partial Prerendering pasa a ser
 * el comportamiento por defecto) y toca justo lo que sostiene la CSP con
 * nonce por petición (P2-2, AUDIT-2026-09-08), así que no es un cambio para
 * meter de refilón en una tarea de rendimiento. `unstable_cache` sigue
 * funcionando en 16.3.4 y es el camino de menor riesgo hoy.
 */

import { revalidateTag } from "next/cache";

/** Cursos, módulos, lecciones, instructores: todo lo que altera una ficha o
 *  el listado del catálogo. */
export const TAG_CATALOGO = "catalogo-publico";

/** Las categorías tienen etiqueta propia porque el selector de filtro se
 *  cachea por separado del listado: renombrar una categoría no tiene por qué
 *  tirar la búsqueda entera. */
export const TAG_CATEGORIAS = "categorias-publicas";

/** Red de seguridad por si una mutación nueva olvida invalidar (ver arriba). */
export const REVALIDAR_SEGUNDOS = 300;

/**
 * Invalida el catálogo público. Se llama desde las Server Actions del panel
 * que publican, despublican, editan u ordenan cursos, módulos, lecciones,
 * instructores o vistas previas.
 *
 * `{ expire: 0 }` en vez del perfil por defecto: sin ventana de contenido
 * rancio, la siguiente petición bloquea hasta traer el dato fresco. Es lo que
 * la documentación de Next recomienda para "el llamador necesita que el dato
 * desaparezca ya" cuando no se puede usar `updateTag` — y no se puede, porque
 * `updateTag` solo funciona con `cacheTag`/`fetch`, no con `unstable_cache`.
 */
export function revalidarCatalogoPublico() {
  revalidateTag(TAG_CATALOGO, { expire: 0 });
}

/** Igual que la anterior, para el selector de categorías. Una categoría
 *  renombrada, activada o desactivada también cambia el listado, así que esta
 *  invalida las dos. */
export function revalidarCategoriasPublicas() {
  revalidateTag(TAG_CATEGORIAS, { expire: 0 });
  revalidateTag(TAG_CATALOGO, { expire: 0 });
}
