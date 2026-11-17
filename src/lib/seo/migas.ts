import { siteUrl } from "@/lib/site-url";
import { sinVacios } from "@/lib/seo/jsonld-util";

/**
 * `BreadcrumbList` de schema.org: la ruta de navegación de una página
 * (SEO/GEO fase 14, datos estructurados completos).
 *
 * Qué aporta
 * ----------
 * Es de los pocos datos estructurados que Google todavía convierte en
 * resultado enriquecido: en vez de la URL cruda, el resultado muestra
 * "uvarq.com › Catálogo › Escuela". También le da al rastreador la jerarquía
 * del sitio (curso dentro de escuela dentro de catálogo) sin adivinarla.
 *
 * Reglas
 * ------
 * - Las migas deben corresponder a la ruta visible de la página. Este JSON-LD
 *   añade "Inicio" al principio aunque la ficha de curso no lo pinte: Google
 *   no exige que coincidan letra por letra, solo que la jerarquía sea la real.
 * - Cada elemento lleva `item` con URL absoluta, también el último (la página
 *   actual). Google permite omitirlo en el último, pero declararlo no hace
 *   daño y evita que un lector ingenuo lo tome por incompleto.
 * - Las rutas son SIEMPRE la versión canónica (con slug), igual que el
 *   canonical de cada página.
 * - Un elemento sin nombre o sin ruta se descarta: una miga vacía es dato
 *   inválido, y las posiciones se recalculan para que sigan siendo 1, 2, 3…
 */

export type Miga = {
  nombre: string;
  /** Ruta relativa a la raíz, con barra inicial: `/catalogo/visualizacion`. */
  ruta: string;
};

/** "Inicio" y "Catálogo": el principio común de toda ruta del catálogo. */
export const MIGAS_CATALOGO: Miga[] = [
  { nombre: "Inicio", ruta: "/" },
  { nombre: "Catálogo", ruta: "/catalogo" },
];

function urlAbsoluta(ruta: string): string {
  // La portada es el origen tal cual, sin barra final: la misma forma que el
  // `url` de la organización y del sitio.
  return ruta === "/" ? siteUrl() : `${siteUrl()}${ruta}`;
}

/**
 * Devuelve `null` si no quedan al menos dos migas válidas: una ruta de un solo
 * elemento no describe ninguna jerarquía y no vale la pena publicarla.
 */
export function construirMigasJsonLd(migas: Miga[]): Record<string, unknown> | null {
  const validas = migas.filter((m) => m.nombre.trim() !== "" && m.ruta.startsWith("/"));
  if (validas.length < 2) return null;

  return sinVacios({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: validas.map((miga, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: miga.nombre.trim(),
      item: urlAbsoluta(miga.ruta),
    })),
  });
}
