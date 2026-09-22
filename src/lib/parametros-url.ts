/**
 * Lectura segura de los parámetros de búsqueda de una URL (`searchParams`).
 * Ver AUDIT-2026-09-22.md — P2-3.
 *
 * El tipo real que entrega Next no es `string`
 * --------------------------------------------
 * `searchParams` es `{ [clave]: string | string[] | undefined }`
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md):
 * si la URL repite un parámetro —`?q=a&q=b`— el valor llega como ARREGLO. Las
 * páginas del catálogo lo declaraban `q?: string` y llamaban `.trim()` sobre
 * él, así que esa URL tumbaba la página con un 500 (verificado en producción
 * el 2026-09-22 en `/catalogo` y `/catalogo/<categoría>`). TypeScript no lo
 * veía porque el tipo declarado mentía; estas funciones reciben el tipo real
 * y obligan a resolverlo.
 *
 * Y por qué además se acotan
 * --------------------------
 * El listado público del catálogo se cachea con `unstable_cache`, cuya clave
 * es `JSON.stringify` de los argumentos: cada `page` distinto (`1`, `1.5`,
 * `-3`, `99999`) era una entrada nueva en `.next/cache/fetch-cache`, un
 * directorio en disco sin límite de tamaño. Normalizar ANTES de llamar a la
 * función cacheada hace que las variantes equivalentes compartan clave y que
 * el conjunto de claves posibles sea finito (ver `buscarCatalogoPublico` en
 * lib/categoria.ts).
 *
 * Módulo puro, sin dependencias de servidor: lo usan las páginas, las
 * funciones de datos y el propio campo de búsqueda (`LARGO_MAXIMO_BUSQUEDA`).
 */

/** El tipo que Next entrega por cada clave de `searchParams`. */
export type ParametroUrl = string | string[] | undefined;

/**
 * Tope de caracteres de un texto de búsqueda. Ningún título de curso ni
 * nombre de instructor se acerca; más largo solo sirve para mandar trabajo
 * inútil a la base. El campo del buscador usa el mismo número como
 * `maxLength`, así que nadie escribe algo que después se recorte en silencio.
 */
export const LARGO_MAXIMO_BUSQUEDA = 100;

/**
 * Página más alta que se acepta. Con 12 cursos por página son 1 200 cursos,
 * muy por encima del catálogo real; el límite existe para acotar las claves
 * de la caché del listado, no para paginar menos.
 */
export const PAGINA_MAXIMA = 100;

/** Primer valor si la URL repite el parámetro; el mismo criterio que `URLSearchParams.get()`. */
export function parametroUnico(valor: ParametroUrl): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Texto de búsqueda listo para consultar, o `undefined` si no hay nada que
 * buscar. Solo recorta los extremos —lo mismo que ya hacía el catálogo—: los
 * espacios internos se respetan para no cambiar ningún resultado.
 *
 * Recorta por caracteres (`Array.from`), no por unidades UTF-16: cortar un
 * emoji a la mitad dejaría un sustituto suelto que no es UTF-8 válido.
 */
export function textoDeBusqueda(
  valor: ParametroUrl,
  largoMaximo = LARGO_MAXIMO_BUSQUEDA,
): string | undefined {
  const limpio = parametroUnico(valor)?.trim();
  if (!limpio) return undefined;
  const acotado = Array.from(limpio).slice(0, largoMaximo).join("").trim();
  return acotado || undefined;
}

/**
 * Número de página entero entre 1 y `maxima`. Cualquier cosa que no sea un
 * número (`abc`, vacío, ausente) es la página 1. Acepta también un número ya
 * convertido, para que las funciones de datos puedan normalizar lo que les
 * llega sin saber de dónde salió.
 */
export function numeroDePagina(valor: ParametroUrl | number, maxima = PAGINA_MAXIMA): number {
  const numero = typeof valor === "number" ? valor : Number(parametroUnico(valor));
  if (!Number.isFinite(numero)) return 1;
  return Math.min(maxima, Math.max(1, Math.floor(numero)));
}
