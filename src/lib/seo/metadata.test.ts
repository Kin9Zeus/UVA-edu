import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LARGO_MAXIMO_TITULO, MARCA, metadataPublica, tituloCurso } from "@/lib/seo/metadata";

/**
 * `siteUrl()` cae a http://localhost:3000 fuera de producción (ver el
 * encabezado de lib/site-url.ts), así que las URLs absolutas de estas
 * pruebas son deterministas sin tocar el entorno.
 */
const ORIGEN = "http://localhost:3000";

describe("metadataPublica", () => {
  it("deja la marca a la plantilla del layout (no la repite en el título)", () => {
    const meta = metadataPublica({
      titulo: "Catálogo de cursos",
      descripcion: "Cursos de arquitectura y obra.",
      ruta: "/catalogo",
    });

    expect(meta.title).toBe("Catálogo de cursos");
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
      title: "Soporte | UVA",
      description: "Dudas frecuentes sobre cuenta y certificados.",
      url: `${ORIGEN}/soporte`,
      locale: "es_CO",
    });
    expect(meta.twitter).toMatchObject({
      title: "Soporte | UVA",
      description: "Dudas frecuentes sobre cuenta y certificados.",
    });
  });

  it("sin imagen comparte la imagen de marca de public/", () => {
    const meta = metadataPublica({
      titulo: "Planes",
      descripcion: "Un plan, todo el catálogo.",
      ruta: "/planes",
    });

    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.openGraph?.images).toEqual([`${ORIGEN}/og-uva.png`]);
    expect(existsSync(join(process.cwd(), "public", "og-uva.png"))).toBe(true);
  });

  it("con imagen null no declara imágenes: las pone el opengraph-image de la ruta", () => {
    const meta = metadataPublica({
      titulo: "Revit desde cero",
      descripcion: "Curso de Revit.",
      ruta: "/cursos/revit",
      imagen: null,
    });

    // Una clave `images` aunque sea vacía tapa la imagen generada por Next.
    expect(meta.openGraph && "images" in meta.openGraph).toBe(false);
    expect(meta.twitter && "images" in meta.twitter).toBe(false);
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

describe("tituloCurso", () => {
  it("agrega «Curso en línea» cuando cabe en 60 caracteres con la marca", () => {
    expect(tituloCurso("Revit para arquitectura")).toBe("Revit para arquitectura — Curso en línea");
  });

  it("si no cabe, deja solo el nombre del curso sin cortarlo", () => {
    const largo = "Gerencia de proyectos, costos y presupuestos de obra";
    expect(tituloCurso(largo)).toBe(largo);
  });

  it("el título con tipo y marca nunca pasa de 60 cuando se agrega el tipo", () => {
    const titulo = tituloCurso("Curso de SketchUp");
    expect(`${titulo} | ${MARCA}`.length).toBeLessThanOrEqual(LARGO_MAXIMO_TITULO);
  });
});
