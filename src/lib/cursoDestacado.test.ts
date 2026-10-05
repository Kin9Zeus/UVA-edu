import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Curso destacado de la portada y del dashboard: una sola consulta, cacheada
 * por la etiqueta del catálogo, que no guarda un fallo ni lo confunde con
 * "no hay curso destacado".
 */
vi.mock("@/lib/supabase/public", () => import("@/test/servidor-falso").then((m) => m.moduloSupabasePublic()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));

const { getCursoDestacado } = await import("@/lib/cursoDestacado");
const { logError } = await import("@/lib/log");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

const filaCurso = {
  id: "k1",
  slug: "revit-desde-cero",
  titulo: "Revit desde cero",
  descripcion: "Curso de Revit",
  imagen_portada: "/portada.jpg",
  nivel: "BASICO",
  modulos: [
    {
      lecciones: [
        { duracion: 300, estado_procesamiento: "LISTO" },
        { duracion: 600, estado_procesamiento: "LISTO" },
      ],
    },
    { lecciones: [{ duracion: 900, estado_procesamiento: "PROCESANDO" }] },
  ],
};

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
});

describe("getCursoDestacado", () => {
  it("cuenta todas las clases pero suma solo la duración de las que tienen video listo", async () => {
    servidorFalso.responder("from:cursos", { data: filaCurso, error: null });

    expect(await getCursoDestacado()).toMatchObject({
      id: "k1",
      slug: "revit-desde-cero",
      nivel: "BASICO",
      totalClases: 3,
      duracionTotalSegundos: 900,
    });
  });

  it("pide curso y lecciones en UNA consulta, con el cliente público", async () => {
    servidorFalso.responder("from:cursos", { data: filaCurso, error: null });

    await getCursoDestacado();

    expect(servidorFalso.operaciones()).toEqual(["from:cursos"]);
    expect(servidorFalso.llamadas[0].cliente).toBe("publico");
    const [seleccion] = servidorFalso.encadenado("from:cursos", "select")[0] as [string];
    expect(seleccion).toContain("modulos(lecciones(");
  });

  it("sin curso destacado: null, y no es un error", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: null });

    expect(await getCursoDestacado()).toBeNull();
    expect(logError).not.toHaveBeenCalled();
  });

  it("si la consulta falla: null (la sección se oculta) y queda registrado", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: ERROR_PG });

    expect(await getCursoDestacado()).toBeNull();
    expect(logError).toHaveBeenCalledWith("home:curso-destacado", expect.any(String), expect.anything(), expect.anything());
  });
});
