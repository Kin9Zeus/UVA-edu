import { describe, expect, it, vi } from "vitest";

const CURSOS = [
  { slug: "revit", actualizado_en: "2026-11-10T00:00:00+00:00", curso_categorias: [{ id_categoria: "bim" }] },
  { slug: "render", actualizado_en: "2026-11-15T00:00:00+00:00", curso_categorias: [{ id_categoria: "viz" }, { id_categoria: "bim" }] },
  { slug: "sin-fecha", actualizado_en: null, curso_categorias: [{ id_categoria: "viz" }] },
];

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: () => ({ select: () => ({ eq: async () => ({ data: CURSOS, error: null }) }) }),
  }),
}));
vi.mock("@/lib/categoria", () => ({
  getCategoriasActivas: async () => [
    { id: "bim", slug: "bim" },
    { id: "viz", slug: "visualizacion" },
  ],
}));
vi.mock("@/lib/features", () => ({ LEGAL_HABILITADO: false, PRECIOS_HABILITADOS: false }));
vi.mock("@/lib/legal/textos", () => ({ getSlugsConTextoVigente: async () => [] }));

const B = "http://localhost:3000";

describe("sitemap", async () => {
  const { default: sitemap } = await import("./sitemap");
  const entradas = await sitemap();
  const fecha = (url: string) => {
    const f = entradas.find((e) => e.url === url)?.lastModified;
    return f ? new Date(f).toISOString() : f;
  };

  it("una escuela lleva la fecha de su curso más reciente", () => {
    expect(fecha(`${B}/catalogo/bim`)).toBe("2026-11-15T00:00:00.000Z");
    expect(fecha(`${B}/catalogo/visualizacion`)).toBe("2026-11-15T00:00:00.000Z");
  });

  it("portada y catálogo llevan la fecha del curso más reciente", () => {
    expect(fecha(B)).toBe("2026-11-15T00:00:00.000Z");
    expect(fecha(`${B}/catalogo`)).toBe("2026-11-15T00:00:00.000Z");
  });

  it("sin priority ni changeFrequency, que Google ignora", () => {
    for (const e of entradas) {
      expect(e).not.toHaveProperty("priority");
      expect(e).not.toHaveProperty("changeFrequency");
    }
  });

  it("no lista login ni registro", () => {
    expect(entradas.some((e) => /\/(login|registro)/.test(e.url))).toBe(false);
  });
});
