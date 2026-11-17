import { siteUrl } from "@/lib/site-url";
import { sinVacios } from "@/lib/seo/jsonld-util";
import type { FiltrosCatalogo } from "@/lib/filtroEstado";
import type { ResultadoCatalogo } from "@/lib/categoria";

/**
 * `ItemList` de schema.org para el catálogo y las páginas de escuela
 * (SEO/GEO fase 14, datos estructurados completos).
 *
 * Forma "de resumen", no de detalle
 * ---------------------------------
 * Cada `ListItem` lleva solo `position` y la `url` canónica del curso. El
 * detalle del curso (nombre, instructor, duración) ya lo publica su ficha en
 * su `Course`; repetirlo aquí crearía dos versiones del mismo dato que pueden
 * contradecirse. Es el patrón de "página de resumen" que describe Google para
 * listas cuyos elementos tienen página propia.
 *
 * Cuándo NO se publica
 * --------------------
 * - Con búsqueda (`?q=`), filtro de nivel o filtro de escuela por parámetro
 *   (`/catalogo?categoria=`). El canonical de esas páginas es
 *   el catálogo sin filtros, así que la lista no coincidiría con la URL que
 *   declara la página como canónica.
 * - Con `?page=` mayor que 1. El listado es acumulado ("cargar más"), y el
 *   canonical es la primera página: se describe lo que ve quien llega por él.
 * - Si la consulta falló (`resultado.fallo`) o no hay cursos: una lista vacía
 *   no es dato, y una lista armada con un fallo afirmaría que no hay cursos.
 */

export function debePublicarLista(filtros: FiltrosCatalogo): boolean {
  return !filtros.q && !filtros.nivel && !filtros.categoria && filtros.pagina <= 1;
}

export function construirListaCursosJsonLd(
  resultado: Pick<ResultadoCatalogo, "cursos" | "fallo">,
): Record<string, unknown> | null {
  if (resultado.fallo) return null;

  const cursos = resultado.cursos.filter((c) => c.slug.trim() !== "");
  if (cursos.length === 0) return null;

  return sinVacios({
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: cursos.length,
    itemListElement: cursos.map((curso, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      // La misma URL que el canonical y el `@id` del `Course` de la ficha:
      // así el elemento de la lista y el curso son el mismo nodo.
      url: `${siteUrl()}/cursos/${curso.slug}`,
    })),
  });
}
