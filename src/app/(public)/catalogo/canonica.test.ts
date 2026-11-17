import { describe, expect, it, vi } from "vitest";

/**
 * SEO fase 14, tarea de migración (paso 9): los filtros y la búsqueda
 * (`?q=`, `?orden=`, `?nivel=`, `?pagina=`) no cambian la canónica. Si la
 * canónica copiara la URL pedida, cada combinación de filtros sería una
 * página duplicada para Google.
 *
 * Solo se prueba la metadata: los datos de la escuela se simulan.
 */
vi.mock("@/lib/categoria", () => ({
  resolverCategoria: vi.fn(async () => ({ id: "e1", slug: "bim", nombre: "BIM", descripcion: null })),
  buscarCatalogoPublico: vi.fn(),
  getNivelesConCursos: vi.fn(),
  getCategoriasActivas: vi.fn(),
}));
vi.mock("@/components/catalogo/CatalogoCursos", () => ({ CatalogoCursos: () => null }));
vi.mock("@/lib/slugs-anteriores", () => ({ slugActual: vi.fn() }));

const ORIGEN = "http://localhost:3000";

describe("canónica del catálogo y de las escuelas", () => {
  it("el catálogo canoniza a /catalogo: su metadata no depende de la URL", async () => {
    const { metadata } = await import("./page");
    expect(metadata.alternates?.canonical).toBe(`${ORIGEN}/catalogo`);
  });

  it("una escuela canoniza a su slug aunque la URL traiga filtros o un UUID", async () => {
    const { generateMetadata } = await import("./[categoriaSlug]/page");
    const props = {
      params: Promise.resolve({ categoriaSlug: "3f0ba9d6-712e-819a-a5cf-f27a6bf4d268" }),
      searchParams: Promise.resolve({ q: "revit", orden: "recientes", nivel: "BASICO", pagina: "2" }),
    };
    // `generateMetadata` ni siquiera recibe los filtros: la canónica no puede
    // depender de ellos. Se pasan igual para que la prueba falle si un día los
    // empieza a leer y los copia.
    const meta = await generateMetadata(props as Parameters<typeof generateMetadata>[0]);
    expect(meta.alternates?.canonical).toBe(`${ORIGEN}/catalogo/bim`);
  });
});
