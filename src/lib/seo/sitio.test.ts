import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";
import { camposVacios } from "@/lib/seo/jsonld-util";
import { idOrganizacion } from "@/lib/seo/organizacion";
import { construirGrafoPortada, construirSitioJsonLd, idSitio } from "@/lib/seo/sitio";

describe("construirSitioJsonLd", () => {
  it("declara los campos obligatorios de WebSite", () => {
    const sitio = construirSitioJsonLd();

    expect(sitio["@type"]).toBe("WebSite");
    expect(sitio["@id"]).toBe(idSitio());
    expect(sitio.url).toBe(siteUrl());
    expect(typeof sitio.name).toBe("string");
    expect(sitio.name).not.toBe("");
  });

  it("el publisher es la misma organización que el provider de los cursos", () => {
    expect(construirSitioJsonLd().publisher).toEqual({ "@id": idOrganizacion() });
  });

  it("no declara la caja de búsqueda que Google retiró", () => {
    expect(construirSitioJsonLd()).not.toHaveProperty("potentialAction");
  });

  it("no emite campos vacíos", () => {
    expect(camposVacios(construirSitioJsonLd())).toEqual([]);
  });
});

describe("construirGrafoPortada", () => {
  it("publica la organización y el sitio en un solo @graph con un solo @context", () => {
    const grafo = construirGrafoPortada();
    const nodos = grafo["@graph"] as Record<string, unknown>[];

    expect(grafo["@context"]).toBe("https://schema.org");
    expect(nodos.map((n) => n["@type"])).toEqual(["EducationalOrganization", "WebSite"]);
    for (const nodo of nodos) expect(nodo).not.toHaveProperty("@context");
  });

  it("la organización del grafo conserva el @id que usan las fichas de curso", () => {
    const [organizacion] = construirGrafoPortada()["@graph"] as Record<string, unknown>[];
    expect(organizacion["@id"]).toBe(idOrganizacion());
  });

  it("la organización declara sus campos obligatorios: @type, @id, name y url", () => {
    const [organizacion] = construirGrafoPortada()["@graph"] as Record<string, unknown>[];

    expect(organizacion["@type"]).toBe("EducationalOrganization");
    expect(typeof organizacion.name).toBe("string");
    expect(organizacion.name).not.toBe("");
    expect(organizacion.url).toBe(siteUrl());
  });

  it("no emite campos vacíos", () => {
    expect(camposVacios(construirGrafoPortada())).toEqual([]);
  });
});
