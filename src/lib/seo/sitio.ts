import { siteUrl } from "@/lib/site-url";
import { sinVacios } from "@/lib/seo/jsonld-util";
import { NOMBRE_ORGANIZACION, idOrganizacion, organizacionCompleta } from "@/lib/seo/organizacion";

/**
 * `WebSite` de schema.org: el sitio como tal, distinto de la organización que
 * lo publica (SEO/GEO fase 14, datos estructurados completos).
 *
 * Qué aporta
 * ----------
 * Le dice al buscador cuál es el nombre del sitio y quién lo publica. Google
 * usa el nombre del `WebSite` de la portada para el "nombre del sitio" que
 * muestra encima de cada resultado. `publisher` apunta por `@id` a la MISMA
 * organización que el `provider` de cada curso: una sola entidad.
 *
 * Lo que NO se emite, a propósito
 * --------------------------------
 * - `potentialAction` / `SearchAction`. Era para la caja de búsqueda dentro
 *   del resultado (sitelinks search box), que Google retiró en noviembre de
 *   2024. Declararla hoy no hace nada.
 * - `alternateName`. El nombre oficial sigue en decisión (decisión 1 de
 *   docs/seo/08-informe.md); cuando Aleck lo fije, cambia
 *   `NOMBRE_ORGANIZACION` y este nodo lo hereda.
 */

/** El `@id` estable del sitio. */
export function idSitio(): string {
  return `${siteUrl()}/#sitio`;
}

export function construirSitioJsonLd(): Record<string, unknown> {
  return sinVacios({
    "@type": "WebSite",
    "@id": idSitio(),
    url: siteUrl(),
    name: NOMBRE_ORGANIZACION,
    inLanguage: "es",
    publisher: { "@id": idOrganizacion() },
  });
}

/**
 * Lo que publica la portada: la organización completa y el sitio, en un solo
 * bloque con `@graph`. Un solo `@context` para los dos nodos, y el `publisher`
 * del sitio resuelve dentro del mismo documento.
 */
export function construirGrafoPortada(): Record<string, unknown> {
  // `organizacionCompleta()` trae su propio `@context` para poder publicarse
  // suelta; dentro de un `@graph` lo pone el contenedor.
  const organizacion: Record<string, unknown> = { ...organizacionCompleta() };
  delete organizacion["@context"];

  return {
    "@context": "https://schema.org",
    "@graph": [sinVacios(organizacion), construirSitioJsonLd()],
  };
}
