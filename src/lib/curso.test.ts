import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Ficha pública del curso: "no existe" y "la base falló" son cosas distintas
 * (AUDIT-2026-09-22.md, seguimiento de P2-3). Antes las dos terminaban en
 * `null` y la página respondía 404, también durante una caída de Supabase.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/accesoCurso", () => ({
  obtenerAccesoAlCurso: vi.fn(async () => ({ tieneAcceso: false, tieneCortesia: false, suscripcion: null })),
}));
vi.mock("@/lib/mux/miniatura", () => ({ getMiniaturaUrl: vi.fn(async () => "https://image.mux.com/miniatura.jpg") }));

const { getCursoPublico } = await import("@/lib/curso");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

const filaCurso = {
  id: "k1",
  slug: "revit-desde-cero",
  titulo: "Revit desde cero",
  descripcion: "Curso de Revit",
  nivel: "BASICO",
  imagen_portada: "/portada.jpg",
  fecha_edicion: "2026-09-01T00:00:00Z",
  mostrado: true,
  curso_categorias: [{ categoria: { id: "c1", slug: "bim", nombre: "BIM" } }],
  modulos: [
    {
      id: "m1",
      titulo: "Módulo 1",
      orden: 10,
      lecciones: [
        { id: "l1", slug: "intro", titulo: "Intro", orden: 10, duracion: 300, estado_procesamiento: "LISTO", id_video_mux: "pb1" },
      ],
    },
  ],
};

beforeEach(() => {
  servidorFalso.reiniciar();
});

describe("getCursoPublico", () => {
  it("curso existente: lo arma completo", async () => {
    servidorFalso.responder("from:cursos", { data: filaCurso, error: null });
    servidorFalso.responder("from:recursos_descargables", { count: 2, error: null });

    const curso = await getCursoPublico("revit-desde-cero", null);

    expect(curso).toMatchObject({
      id: "k1",
      slug: "revit-desde-cero",
      totalClases: 1,
      totalRecursos: 2,
      duracionTotalSegundos: 300,
      categorias: [{ id: "c1", slug: "bim", nombre: "BIM" }],
    });
    expect(curso?.modulos[0].lecciones[0].miniaturaUrl).toBe("https://image.mux.com/miniatura.jpg");
  });

  it("no existe (o RLS no deja verlo): null, y la página hará notFound() (404)", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: null });

    expect(await getCursoPublico("no-existe", null)).toBeNull();
  });

  it("la consulta falla: LANZA en vez de devolver null (antes era un 404 durante cualquier caída)", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: ERROR_PG });

    await expect(getCursoPublico("revit-desde-cero", null)).rejects.toThrow(/getCursoPublico falló.*57014/);
  });

  it("usa maybeSingle: con `single`, 'no hay fila' también llega como error (PGRST116)", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: null });

    await getCursoPublico("revit-desde-cero", null);

    const metodos = servidorFalso.llamadasA("from:cursos")[0].cadena.map((c) => c.metodo);
    expect(metodos).toContain("maybeSingle");
    expect(metodos).not.toContain("single");
  });

  it("un uuid busca por id y un slug por slug (enlaces anteriores al cambio de rutas)", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: null });

    await getCursoPublico("3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f", null);
    await getCursoPublico("revit-desde-cero", null);

    const filtros = servidorFalso.encadenado("from:cursos", "eq").map((args) => args[0]);
    expect(filtros).toEqual(["id", "slug"]);
  });
});
