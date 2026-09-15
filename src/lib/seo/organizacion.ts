import { siteUrl } from "@/lib/site-url";

/**
 * La identidad de U.V.A como entidad, en el vocabulario de schema.org.
 *
 * Por qué vive aparte del curso (P2-5, AUDIT-2026-09-15.md)
 * ---------------------------------------------------------
 * Ahora mismo tiene un solo uso: el `provider` del `Course` de la ficha
 * (lib/seo/curso-jsonld.ts). Pero es exactamente el mismo nodo que P2-6
 * necesita publicar SUELTO en la home como `Organization` —el que hace que
 * Google asocie el nombre, el dominio y el logo a una sola entidad— y no
 * tiene sentido que existan dos definiciones de quiénes somos que puedan
 * contradecirse.
 *
 * `@id` es lo que permite esa unión. Publicar `Organization` en la home y
 * referenciarla desde cada ficha con el MISMO `@id` le dice a Google que son
 * la misma entidad, no dos organizaciones con nombre parecido. Por eso el id
 * es una URL estable (`<origen>/#organizacion`) y no un uuid: es la
 * convención que entienden los consumidores de JSON-LD.
 *
 * `siteUrl()` y no una constante: el origen es una propiedad del despliegue
 * (ver el encabezado de lib/site-url.ts) y en local, en CI y en producción
 * son distintos. Un `@id` con el dominio equivocado es peor que ninguno.
 */
export const NOMBRE_ORGANIZACION = "U.V.A — Unidad Vectorial de Arquitectura";

/** El `@id` estable de la organización. Úsalo para referenciarla desde otros nodos. */
export function idOrganizacion(): string {
  return `${siteUrl()}/#organizacion`;
}

/**
 * Referencia ligera, para incrustar dentro de otro nodo (`provider`,
 * `publisher`). Solo el `@id`: el nodo completo lo publica la home.
 *
 * Mientras P2-6 no publique ese nodo completo, se incluyen también `name` y
 * `url` — un `@id` que no resuelve a ningún nodo definido deja el `provider`
 * vacío para quien no siga la referencia. Cuando la home publique la
 * `Organization` entera, estos dos campos se vuelven redundantes pero no
 * dañinos: schema.org permite repetirlos y Google los reconcilia por `@id`.
 */
export function referenciaOrganizacion() {
  return {
    "@type": "Organization",
    "@id": idOrganizacion(),
    name: NOMBRE_ORGANIZACION,
    url: siteUrl(),
  } as const;
}

/**
 * El nodo completo, para que P2-6 lo publique en la home.
 *
 * Sin `logo` a propósito: `public/` no tiene hoy ningún asset de marca (solo
 * los SVG de ejemplo que trae create-next-app), y el logo del header es un
 * componente, no un archivo servible. `logo` es REQUERIDO para el rich
 * result de Organization, así que esto queda incompleto hasta que exista esa
 * imagen — declarar una URL que da 404 es peor que omitir el campo.
 */
export function organizacionCompleta() {
  return {
    "@context": "https://schema.org",
    ...referenciaOrganizacion(),
  };
}
