import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";
import { camposVacios } from "@/lib/seo/jsonld-util";
import { construirListaCursosJsonLd, debePublicarLista } from "@/lib/seo/lista-cursos";
import type { CursoDeCategoria, ResultadoCatalogo } from "@/lib/categoria";

/** Solo `slug` entra al ItemList; el `as` evita rellenar los demás campos de la tarjeta. */
function curso(slug: string): CursoDeCategoria {
  return { id: slug, slug, titulo: slug } as CursoDeCategoria;
}

function resultado(slugs: string[], fallo?: true): Pick<ResultadoCatalogo, "cursos" | "fallo"> {
  return { cursos: slugs.map(curso), ...(fallo ? { fallo } : {}) };
}

type Elemento = { "@type": string; position: number; url: string };

describe("construirListaCursosJsonLd", () => {
  it("declara el tipo y, en cada elemento, position y url", () => {
    const jsonLd = construirListaCursosJsonLd(resultado(["revit", "sketchup"]));
    const lista = jsonLd?.itemListElement as Elemento[];

    expect(jsonLd?.["@type"]).toBe("ItemList");
    expect(jsonLd?.numberOfItems).toBe(2);
    expect(lista).toEqual([
      { "@type": "ListItem", position: 1, url: `${siteUrl()}/cursos/revit` },
      { "@type": "ListItem", position: 2, url: `${siteUrl()}/cursos/sketchup` },
    ]);
  });

  it("la url de cada curso es la misma que el @id de su Course (slug, nunca uuid)", () => {
    const [elemento] = construirListaCursosJsonLd(resultado(["revit"]))?.itemListElement as Elemento[];
    expect(elemento.url).toMatch(/\/cursos\/revit$/);
  });

  it("no publica una lista vacía", () => {
    expect(construirListaCursosJsonLd(resultado([]))).toBeNull();
  });

  it("no publica nada si la consulta falló: no afirma que no hay cursos", () => {
    expect(construirListaCursosJsonLd(resultado(["revit"], true))).toBeNull();
  });

  it("descarta un curso sin slug en vez de emitir una url rota", () => {
    const jsonLd = construirListaCursosJsonLd(resultado(["revit", " "]));
    expect(jsonLd?.numberOfItems).toBe(1);
  });

  it("no emite campos vacíos", () => {
    expect(camposVacios(construirListaCursosJsonLd(resultado(["revit", "sketchup"])))).toEqual([]);
  });
});

describe("debePublicarLista", () => {
  it("sí en la primera página sin filtros", () => {
    expect(debePublicarLista({ pagina: 1 })).toBe(true);
  });

  it("no con búsqueda, filtro de nivel, filtro de escuela o página mayor que 1", () => {
    expect(debePublicarLista({ pagina: 1, q: "revit" })).toBe(false);
    expect(debePublicarLista({ pagina: 1, nivel: "BASICO" })).toBe(false);
    expect(debePublicarLista({ pagina: 1, categoria: "visualizacion" })).toBe(false);
    expect(debePublicarLista({ pagina: 2 })).toBe(false);
  });
});
