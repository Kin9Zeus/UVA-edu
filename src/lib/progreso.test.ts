import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { getProgresoData } = await import("@/lib/progreso");

const fila = (id: string, completadas: number, total: number, extra: Record<string, unknown> = {}) => ({
  curso_id: id,
  curso_slug: id,
  titulo: `Curso ${id}`,
  imagen_portada: "/p.jpg",
  lecciones_completadas: completadas,
  lecciones_total: total,
  examen_requerido: false,
  examen_aprobado: false,
  ultima_actividad: "2026-10-20T15:00:00Z",
  ...extra,
});

const leccion = (slug: string, orden: number, completado: boolean) => ({
  slug,
  titulo: `Clase ${slug}`,
  orden,
  duracion: 600,
  estado_procesamiento: "LISTO",
  progreso: completado ? [{ completado: true, segundo_actual: 600 }] : [],
});

beforeEach(() => {
  servidorFalso.reiniciar();
});

describe("getProgresoData (Mis cursos)", () => {
  it("deja fuera los cursos sin clases con video listo", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", {
      data: [fila("con-clases", 1, 3), fila("vacio", 0, 0)],
      error: null,
    });
    const { cursos } = await getProgresoData();
    expect(cursos.map((curso) => curso.cursoId)).toEqual(["con-clases"]);
  });

  it("conserva un curso sin clases si ya aprobó su examen (está completo)", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", {
      data: [fila("solo-examen", 0, 0, { examen_requerido: true, examen_aprobado: true })],
      error: null,
    });
    const { cursos } = await getProgresoData();
    expect(cursos).toHaveLength(1);
    expect(cursos[0].completado).toBe(true);
  });

  it("arma la clase siguiente con su número en el temario y su módulo", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: [fila("apu", 2, 3)], error: null });
    servidorFalso.responder("from:modulos", {
      data: [
        { id_curso: "apu", orden: 2, titulo: "Módulo 2", lecciones: [leccion("c3", 1, false)] },
        { id_curso: "apu", orden: 1, titulo: "Módulo 1", lecciones: [leccion("c2", 2, true), leccion("c1", 1, true)] },
      ],
      error: null,
    });
    const { cursos } = await getProgresoData();
    expect(cursos[0].siguienteLeccion).toEqual({
      slug: "c3",
      titulo: "Clase c3",
      numero: 3,
      moduloTitulo: "Módulo 2",
      duracion: 600,
    });
  });

  it("marca el curso que salió del catálogo sin quitarlo de la lista", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", {
      data: [fila("publicado", 1, 3), fila("oculto", 1, 3)],
      error: null,
    });
    servidorFalso.responder("from:cursos", {
      data: [
        { id: "publicado", mostrado: true },
        { id: "oculto", mostrado: false },
      ],
      error: null,
    });
    const { cursos } = await getProgresoData();
    expect(cursos.map((curso) => [curso.cursoId, curso.publicado])).toEqual([
      ["publicado", true],
      ["oculto", false],
    ]);
  });
});
