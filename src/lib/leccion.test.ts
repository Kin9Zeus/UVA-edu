import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Reproductor de la lección: "no existe / sin acceso" y "la base falló" son
 * cosas distintas (AUDIT-2026-09-22.md, seguimiento de P2-3). Antes todo
 * fallo salía como `null` —la página devolvía a la ficha o respondía 404— y
 * un fallo del progreso arrancaba el video en 0 y dejaba que el guardado
 * periódico pisara el segundo donde el estudiante se había quedado.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/accesoCurso", () => ({
  obtenerAccesoAlCurso: vi.fn(async () => ({ tieneAcceso: true, tieneCortesia: false, suscripcion: null })),
}));
vi.mock("@/lib/mux/miniatura", () => ({ getMiniaturaUrl: vi.fn(async () => "https://image.mux.com/miniatura.jpg") }));
vi.mock("@/lib/examen", () => ({ getSituacionExamen: vi.fn(async () => ({ situacion: "SIN_EXAMEN" })) }));

const { getLeccionPlayer } = await import("@/lib/leccion");
const { obtenerAccesoAlCurso } = await import("@/lib/accesoCurso");
const { logError } = await import("@/lib/log");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

const leccion = (id: string, slug: string, orden: number) => ({
  id,
  slug,
  titulo: `Clase ${slug}`,
  orden,
  duracion: 300,
  resumen: null,
  contenido: null,
  id_video_mux: `pb-${id}`,
  estado_procesamiento: "LISTO",
});

/** `clase-2` no es la introducción pública: pasa por el muro de acceso. */
function cursoConDosClases() {
  servidorFalso.responder("from:cursos", {
    data: { id: "k1", slug: "revit-desde-cero", titulo: "Revit desde cero", mostrado: true },
    error: null,
  });
  servidorFalso.responder("from:modulos", {
    data: [{ id: "m1", titulo: "Módulo 1", orden: 10, lecciones: [leccion("l1", "intro", 10), leccion("l2", "clase-2", 20)] }],
    error: null,
  });
}

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
  vi.mocked(obtenerAccesoAlCurso).mockClear();
});

describe("getLeccionPlayer", () => {
  it("arma la clase y retoma en el segundo guardado", async () => {
    cursoConDosClases();
    servidorFalso.responder("from:progreso", {
      data: [{ id_leccion: "l2", completado: false, segundo_actual: 1234 }],
      error: null,
    });
    servidorFalso.responder("from:recursos_descargables", {
      data: [{ id: "r1", nombre: "Planos.pdf", tipo_archivo: "pdf", tamano_bytes: 1000 }],
      error: null,
    });

    const data = await getLeccionPlayer("revit-desde-cero", "clase-2", "u1");

    expect(data).toMatchObject({ cursoId: "k1", leccionId: "l2", numero: 2, totalClases: 2, segundoActual: 1234 });
    expect(data?.recursos).toHaveLength(1);
    expect(obtenerAccesoAlCurso).toHaveBeenCalledOnce();
  });

  it("ya no consulta la categoría del curso: el campo no lo leía nadie", async () => {
    cursoConDosClases();

    await getLeccionPlayer("revit-desde-cero", "clase-2", "u1");

    expect(servidorFalso.llamadasA("from:curso_categorias")).toHaveLength(0);
  });

  it("curso que no existe (o RLS no deja verlo): null, sin lanzar", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: null });

    expect(await getLeccionPlayer("no-existe", "intro", "u1")).toBeNull();
    const metodos = servidorFalso.llamadasA("from:cursos")[0].cadena.map((c) => c.metodo);
    expect(metodos).toContain("maybeSingle");
    expect(metodos).not.toContain("single");
  });

  it("sin acceso de verdad: null (la página devuelve a la ficha)", async () => {
    cursoConDosClases();
    vi.mocked(obtenerAccesoAlCurso).mockResolvedValueOnce({ tieneAcceso: false, tieneCortesia: false, suscripcion: null });

    expect(await getLeccionPlayer("revit-desde-cero", "clase-2", "u1")).toBeNull();
  });

  it.each([
    ["cursos", "getLeccionPlayer:cursos"],
    ["modulos", "getLeccionPlayer:modulos"],
    ["progreso", "getLeccionPlayer:progreso"],
  ])("si falla la consulta de %s: LANZA en vez de devolver null o un avance vacío", async (tabla, consulta) => {
    cursoConDosClases();
    servidorFalso.responder(`from:${tabla}`, { data: null, error: ERROR_PG });

    await expect(getLeccionPlayer("revit-desde-cero", "clase-2", "u1")).rejects.toThrow(
      new RegExp(`${consulta} falló.*57014`),
    );
  });

  it("si falla la verificación de acceso: la excepción sube (no se lee como 'sin acceso')", async () => {
    cursoConDosClases();
    vi.mocked(obtenerAccesoAlCurso).mockRejectedValueOnce(new Error("obtenerAccesoAlCurso:suscripciones falló"));

    await expect(getLeccionPlayer("revit-desde-cero", "clase-2", "u1")).rejects.toThrow(/suscripciones falló/);
  });

  it("si fallan los recursos: NO lanza (no vale tumbar la clase), queda registrado", async () => {
    cursoConDosClases();
    servidorFalso.responder("from:recursos_descargables", { data: null, error: ERROR_PG });

    const data = await getLeccionPlayer("revit-desde-cero", "clase-2", "u1");

    expect(data?.recursos).toEqual([]);
    expect(logError).toHaveBeenCalledWith("leccion:recursos", expect.any(String), ERROR_PG, expect.anything());
  });
});
