import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parsearBloques, indiceDeBloques } from "@/lib/legal/bloques";
import { TextoLegal } from "@/components/legal/TextoLegal";

function renderizar(contenido: unknown[]): string {
  return renderToStaticMarkup(createElement(TextoLegal, { bloques: parsearBloques(contenido) }));
}

describe("TextoLegal", () => {
  it("dibuja el título con la misma ancla que el índice", () => {
    const contenido = [
      { tipo: "titulo", nivel: 2, texto: "1. Quiénes somos" },
      { tipo: "titulo", nivel: 2, texto: "1. Quiénes somos" },
    ];
    const html = renderizar(contenido);
    const ids = indiceDeBloques(parsearBloques(contenido)).map((e) => e.id);
    for (const id of ids) expect(html).toContain(`id="${id}"`);
    expect(new Set(ids).size).toBe(2);
  });

  it("escapa el texto: un <script> en el contenido sale como texto, no como etiqueta", () => {
    const html = renderizar([{ tipo: "parrafo", contenido: "<script>alert(1)</script>" }]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("los enlaces https abren en otra pestaña con rel seguro y lo dicen a los lectores de pantalla", () => {
    const html = renderizar([
      { tipo: "parrafo", contenido: [{ texto: "SIC", enlace: "https://www.sic.gov.co" }] },
    ]);
    expect(html).toContain('href="https://www.sic.gov.co"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("(abre en otra pestaña)");
  });

  it("los enlaces del propio sitio y mailto no abren pestaña nueva", () => {
    const html = renderizar([
      {
        tipo: "parrafo",
        contenido: [
          { texto: "datos", enlace: "/legal/datos-personales" },
          { texto: "correo", enlace: "mailto:datos@uva.com" },
        ],
      },
    ]);
    expect(html).toContain('href="/legal/datos-personales"');
    expect(html).toContain('href="mailto:datos@uva.com"');
    expect(html).not.toContain('target="_blank"');
  });

  it("una tabla sale como tabla real (con cabeceras de columna y de fila) y como fichas para celular", () => {
    const html = renderizar([
      {
        tipo: "tabla",
        columnas: ["Norma", "Qué nos exige"],
        filas: [
          ["Ley 1581 de 2012", "Autorización previa"],
          ["Ley 527 de 1999", "Validez de la aceptación electrónica"],
        ],
      },
    ]);
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    // La versión de celular lleva la etiqueta de la columna antes de cada dato.
    expect(html).toContain("<dl");
    expect(html).toMatch(/<dt[^>]*>Qué nos exige<\/dt>/);
    // Cada versión se oculta en el tamaño que no le toca.
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden w-full");
  });

  it("una lista ordenada es <ol> y una sin orden <ul>", () => {
    const html = renderizar([
      { tipo: "lista", ordenada: true, items: ["a", "b"] },
      { tipo: "lista", ordenada: false, items: ["c"] },
    ]);
    expect(html).toContain("<ol");
    expect(html).toContain("<ul");
  });

  it("una nota lleva role=note", () => {
    expect(renderizar([{ tipo: "nota", contenido: "Decisión de diseño." }])).toContain('role="note"');
  });
});
