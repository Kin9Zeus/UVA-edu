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
 * UVA"— y ninguna declaraba canonical ni tarjeta social. La única página
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
 * `imagen` es opcional: la ficha de curso pasa su portada. Sin ella, la
 * página comparte la imagen de marca de 1200x630 (`public/og-uva.png`,
 * SEO fase 14), así ninguna tarjeta sale sin imagen.
 */
const IMAGEN_MARCA = "/og-uva.png";

/** Descripción del sitio: respaldo del layout raíz y del manifest. */
export const DESCRIPCION_SITIO =
  "Cursos en línea de arquitectura, obra, presupuesto y BIM para el sector de la construcción. Formación técnica de UVA, con acceso por invitación.";

/**
 * Nombre corto de la marca en los títulos («Catálogo de cursos | UVA»).
 * Lo pone la plantilla `title.template` del layout raíz a todas las páginas;
 * aquí solo se repite para Open Graph y Twitter, que no heredan la
 * plantilla. Cuando Aleck decida el nombre oficial (decisión 1 de
 * docs/seo/08-informe.md), se cambia solo esta constante.
 */
export const MARCA = "UVA";

/** Largo máximo de un título en resultados de búsqueda (tarea de metadatos, Notion). */
export const LARGO_MAXIMO_TITULO = 60;

/**
 * Título de la ficha de curso: «[Curso] — Curso en línea». Si con la marca
 * pasa de 60 caracteres, queda solo el nombre del curso: no se corta, Google
 * ya recorta lo que no cabe y un nombre partido se lee peor.
 */
export function tituloCurso(nombre: string): string {
  const conTipo = `${nombre} — Curso en línea`;
  return `${conTipo} | ${MARCA}`.length <= LARGO_MAXIMO_TITULO ? conTipo : nombre;
}

type OpcionesMetadata = {
  /** Sin la marca: la agrega la plantilla del layout raíz. */
  titulo: string;
  descripcion: string;
  /** Ruta absoluta desde la raíz, con `/` inicial. La home es `"/"`. */
  ruta: string;
  /**
   * URL absoluta de la imagen social. Sin ella, la de marca. `null`: no se
   * declara porque la ruta tiene su propio `opengraph-image` (la ficha de
   * curso) y Next pone esa URL, que lleva un sufijo que no se puede escribir a mano.
   */
  imagen?: string | null;
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
  const tituloCompleto = `${titulo} | ${MARCA}`;
  const imagenes = imagen === null ? undefined : [imagen ?? `${siteUrl()}${IMAGEN_MARCA}`];

  return {
    title: titulo,
    description: descripcion,
    alternates: {
      canonical: `${siteUrl()}${ruta}`,
    },
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: MARCA,
      title: tituloCompleto,
      description: descripcion,
      url: `${siteUrl()}${ruta}`,
      ...(imagenes ? { images: imagenes } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: tituloCompleto,
      description: descripcion,
      ...(imagenes ? { images: imagenes } : {}),
    },
    ...(indexable ? {} : { robots: { index: false, follow: false } }),
  };
}
