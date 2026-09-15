import { describe, expect, it } from "vitest";
import { metadataPublica } from "@/lib/seo/metadata";

/**
 * `siteUrl()` cae a http://localhost:3000 fuera de producción (ver el
 * encabezado de lib/site-url.ts), así que las URLs absolutas de estas
 * pruebas son deterministas sin tocar el entorno.
 */
const ORIGEN = "http://localhost:3000";

describe("metadataPublica", () => {
  it("antepone el prefijo de marca al título", () => {
    const meta = metadataPublica({
      titulo: "Catálogo de cursos",
      descripcion: "Cursos de arquitectura y obra.",
      ruta: "/catalogo",
    });

    expect(meta.title).toBe("U.V.A. — Catálogo de cursos");
  });

  it("resuelve el canonical a una URL absoluta contra el origen del despliegue", () => {
    const meta = metadataPublica({
      titulo: "Catálogo de cursos",
      descripcion: "Cursos de arquitectura y obra.",
      ruta: "/catalogo",
    });

    expect(meta.alternates?.canonical).toBe(`${ORIGEN}/catalogo`);
  });

  it("la home canoniza a la raíz, no a una ruta vacía", () => {
    const meta = metadataPublica({
      titulo: "La escuela del oficio de la construcción",
      descripcion: "Formación técnica para el gremio.",
      ruta: "/",
    });

    expect(meta.alternates?.canonical).toBe(`${ORIGEN}/`);
  });

  it("OpenGraph y Twitter repiten título y descripción, sin inventar otros", () => {
    const meta = metadataPublica({
      titulo: "Soporte",
      descripcion: "Dudas frecuentes sobre cuenta y certificados.",
      ruta: "/soporte",
    });

    expect(meta.openGraph).toMatchObject({
      title: "U.V.A. — Soporte",
      description: "Dudas frecuentes sobre cuenta y certificados.",
      url: `${ORIGEN}/soporte`,
      locale: "es_CO",
    });
    expect(meta.twitter).toMatchObject({
      title: "U.V.A. — Soporte",
      description: "Dudas frecuentes sobre cuenta y certificados.",
    });
  });

  it("sin imagen NO declara images y la tarjeta baja a 'summary'", () => {
    const meta = metadataPublica({
      titulo: "Planes",
      descripcion: "Un plan, todo el catálogo.",
      ruta: "/planes",
    });

    // Una tarjeta 'summary_large_image' sin imagen se renderiza rota; sin
    // asset de marca todavía, 'summary' es la forma honesta.
    expect(meta.twitter).toMatchObject({ card: "summary" });
    expect(meta.openGraph?.images).toBeUndefined();
    expect(meta.twitter && "images" in meta.twitter ? meta.twitter.images : undefined).toBeUndefined();
  });

  it("con imagen sube a 'summary_large_image' y la propaga a ambas tarjetas", () => {
    const meta = metadataPublica({
      titulo: "Planes",
      descripcion: "Un plan, todo el catálogo.",
      ruta: "/planes",
      imagen: `${ORIGEN}/og.png`,
    });

    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.openGraph?.images).toEqual([`${ORIGEN}/og.png`]);
  });

  it("por defecto la página es indexable: no declara robots", () => {
    const meta = metadataPublica({
      titulo: "Catálogo de cursos",
      descripcion: "Cursos de arquitectura y obra.",
      ruta: "/catalogo",
    });

    expect(meta.robots).toBeUndefined();
  });

  it("indexable:false declara noindex y nofollow", () => {
    const meta = metadataPublica({
      titulo: "Interna",
      descripcion: "No debe salir en búsquedas.",
      ruta: "/interna",
      indexable: false,
    });

    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
