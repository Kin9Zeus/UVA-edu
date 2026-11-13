import { siteUrl } from "@/lib/site-url";
import { CORREO_SOPORTE, REDES, WHATSAPP_VISIBLE } from "@/lib/contacto";

/**
 * La identidad de UVA como entidad, en el vocabulario de schema.org.
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
export const NOMBRE_ORGANIZACION = "UVA — Unidad Vectorial de Arquitectura";

/** El `@id` estable de la organización. Úsalo para referenciarla desde otros nodos. */
export function idOrganizacion(): string {
  return `${siteUrl()}/#organizacion`;
}

/**
 * Referencia ligera, para incrustar dentro de otro nodo (`provider`,
 * `publisher`). Solo el `@id`: el nodo completo lo publica la home.
 *
 * Se incluyen también `name` y `url`: quien lea una ficha de curso sin
 * seguir la referencia ve igual a quién pertenece. schema.org permite
 * repetirlos y Google los reconcilia por `@id`.
 */
export function referenciaOrganizacion() {
  return {
    "@type": "EducationalOrganization",
    "@id": idOrganizacion(),
    name: NOMBRE_ORGANIZACION,
    url: siteUrl(),
  } as const;
}

/**
 * El nodo completo, que publica la home (SEO fase 14, docs/marca/03-sameas.md).
 *
 * - `logo`: `public/logo-uva.png`, cuadrado y sobre blanco (así lo muestra
 *   Google). Va con el host de `siteUrl()`, igual que el `@id`.
 * - `sameAs`: solo perfiles confirmados como oficiales. Spotify sigue
 *   pendiente de confirmar (decisión 5 de docs/seo/08-informe.md), por eso
 *   está en el pie de página pero no aquí.
 * - Sin `address`: solo si la oficina atiende público (decisión 4).
 */
export function organizacionCompleta() {
  return {
    "@context": "https://schema.org",
    ...referenciaOrganizacion(),
    logo: `${siteUrl()}/logo-uva.png`,
    sameAs: [REDES.youtube, REDES.instagram, REDES.tiktok],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CORREO_SOPORTE,
      telephone: WHATSAPP_VISIBLE.replaceAll(" ", "-"),
      availableLanguage: "es",
    },
  };
}
