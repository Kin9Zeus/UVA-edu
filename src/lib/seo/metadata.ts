import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * Metadata de una página pública: título, descripción, canonical, OpenGraph
 * y Twitter, resueltos de una sola forma.
 * Cierra AUDIT-2026-09-15.md — P2-6.
 *
 * El problema que resuelve
 * -----------------------
 * Antes de esto, la home no exportaba `metadata` en absoluto y `catalogo`,
 * `catalogo/[categoriaSlug]`, `planes`, `soporte` y
 * `verificar-certificado/[codigo]` exportaban SOLO un título. Todas
 * heredaban del layout raíz la misma descripción —"Plataforma de cursos
 * U.V.A"— y ninguna declaraba canonical ni tarjeta social. La única página
 * con metadata completa era la ficha de curso, y estaba escrita a mano allí.
 *
 * Repetir ese bloque en seis archivos es la forma segura de que dentro de un
 * mes haya seis variantes distintas. De ahí esta función.
 *
 * Por qué el canonical es obligatorio y no opcional
 * -------------------------------------------------
 * `ruta` no tiene valor por defecto a propósito. Una página sin canonical es
 * el estado que P2-6 vino a corregir, así que olvidarlo tiene que ser
 * imposible, no cómodo. Se pasa la ruta y la función arma la URL absoluta
 * contra `siteUrl()` — nunca contra el `Host` de la petición, por el motivo
 * que documenta el encabezado de lib/site-url.ts.
 *
 * Sobre `og:image`
 * ----------------
 * `imagen` es opcional y hoy NADIE la pasa, porque no existe un asset de
 * marca: `public/` solo tiene los SVG de ejemplo de create-next-app y el
 * logo del header es un componente, no un archivo servible. Es el mismo
 * hueco que deja `logo` vacío en lib/seo/organizacion.ts, y tiene el mismo
 * remedio: cuando exista una imagen de 1200x630 en `public/`, se pasa aquí
 * una vez y todas las páginas la heredan.
 *
 * Mientras tanto NO se inventa una: una tarjeta social sin imagen se ve
 * sobria; una que apunta a un 404 se ve rota.
 */

/** El prefijo que ya usaban a mano todas las páginas públicas. */
const PREFIJO = "U.V.A. — ";

type OpcionesMetadata = {
  /** Sin el prefijo: la función lo antepone. */
  titulo: string;
  descripcion: string;
  /** Ruta absoluta desde la raíz, con `/` inicial. La home es `"/"`. */
  ruta: string;
  /** URL absoluta de la imagen social. Ver el encabezado. */
  imagen?: string;
  /**
   * `false` para páginas que no deben aparecer en resultados de búsqueda.
   * Ojo: si la ruta además está en el `disallow` de robots.ts, Google no
   * llegará a leer este `noindex` —no puede crawlear para verlo—. Se declara
   * igual porque es la afirmación correcta sobre la página, y porque el día
   * que alguien afloje robots.txt esto pasa a ser lo que la protege.
   */
  indexable?: boolean;
};

export function metadataPublica({
  titulo,
  descripcion,
  ruta,
  imagen,
  indexable = true,
}: OpcionesMetadata): Metadata {
  const tituloCompleto = `${PREFIJO}${titulo}`;
  const imagenes = imagen ? [imagen] : undefined;

  return {
    title: tituloCompleto,
    description: descripcion,
    alternates: {
      canonical: `${siteUrl()}${ruta}`,
    },
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: PREFIJO.replace(" — ", ""),
      title: tituloCompleto,
      description: descripcion,
      url: `${siteUrl()}${ruta}`,
      images: imagenes,
    },
    twitter: {
      card: imagen ? "summary_large_image" : "summary",
      title: tituloCompleto,
      description: descripcion,
      images: imagenes,
    },
    ...(indexable ? {} : { robots: { index: false, follow: false } }),
  };
}
