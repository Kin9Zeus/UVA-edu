import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";
import { camposVacios } from "@/lib/seo/jsonld-util";
import { MIGAS_CATALOGO, construirMigasJsonLd } from "@/lib/seo/migas";

type Elemento = { "@type": string; position: number; name: string; item: string };

function elementos(jsonLd: Record<string, unknown> | null): Elemento[] {
  return (jsonLd?.itemListElement ?? []) as Elemento[];
}

const RUTA_CURSO = [
  ...MIGAS_CATALOGO,
  { nombre: "Visualización", ruta: "/catalogo/visualizacion" },
  { nombre: "Render fotorrealista con V-Ray", ruta: "/cursos/render-fotorrealista-con-v-ray" },
];

describe("construirMigasJsonLd", () => {
  it("declara el tipo y, en cada elemento, position, name e item", () => {
    const jsonLd = construirMigasJsonLd(RUTA_CURSO);

    expect(jsonLd?.["@type"]).toBe("BreadcrumbList");
    for (const elemento of elementos(jsonLd)) {
      expect(elemento["@type"]).toBe("ListItem");
      expect(elemento.position).toBeGreaterThan(0);
      expect(elemento.name).not.toBe("");
      expect(elemento.item).toMatch(/^https?:\/\//);
    }
  });

  it("numera las posiciones desde 1 y en orden", () => {
    expect(elementos(construirMigasJsonLd(RUTA_CURSO)).map((e) => e.position)).toEqual([1, 2, 3, 4]);
  });

  it("arma URLs absolutas con el origen del despliegue; la portada sin barra final", () => {
    expect(elementos(construirMigasJsonLd(RUTA_CURSO)).map((e) => e.item)).toEqual([
      siteUrl(),
      `${siteUrl()}/catalogo`,
      `${siteUrl()}/catalogo/visualizacion`,
      `${siteUrl()}/cursos/render-fotorrealista-con-v-ray`,
    ]);
  });

  it("descarta una miga sin nombre y recalcula las posiciones", () => {
    const jsonLd = construirMigasJsonLd([
      ...MIGAS_CATALOGO,
      { nombre: "  ", ruta: "/catalogo/sin-nombre" },
      { nombre: "Curso", ruta: "/cursos/curso" },
    ]);

    expect(elementos(jsonLd).map((e) => [e.position, e.name])).toEqual([
      [1, "Inicio"],
      [2, "Catálogo"],
      [3, "Curso"],
    ]);
  });

  it("no publica una ruta de un solo elemento: no describe ninguna jerarquía", () => {
    expect(construirMigasJsonLd([{ nombre: "Inicio", ruta: "/" }])).toBeNull();
    expect(construirMigasJsonLd([])).toBeNull();
  });

  it("no emite campos vacíos", () => {
    expect(camposVacios(construirMigasJsonLd(RUTA_CURSO))).toEqual([]);
  });
});
