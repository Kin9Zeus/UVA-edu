import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { getCursosListado } = await import("./cursos");
const { textoDespublicar } = await import("@/components/admin/cursos/CursosTable");
const { puntosDeCurva } = await import("@/components/admin/cursos/EstudiantesTab");
const { mayorCaida } = await import("@/components/admin/cursos/CurvaAvance");

beforeEach(() => servidorFalso.reiniciar());

const PORTADA = "https://storage.example/portada.webp";
const curso = (id: string, extra: Record<string, unknown>) => ({
  id,
  slug: id,
  titulo: id,
  nivel: "BASICO",
  mostrado: true,
  destacado: false,
  orden_visualizacion: 0,
  imagen_portada: PORTADA,
  modulos: [{ lecciones: [{ estado_procesamiento: "LISTO" }] }],
  ...extra,
});

describe("getCursosListado", () => {
  it("cuenta clases, lo que falta para publicar, la gente de la RPC y el curso de la portada", async () => {
    servidorFalso.responder("from:cursos", {
      data: [
        curso("revit", { destacado: true, orden_visualizacion: 2 }),
        // Destacado pero en borrador: no sale en la portada.
        curso("mep", {
          mostrado: false,
          destacado: true,
          orden_visualizacion: 1,
          imagen_portada: null,
          modulos: [{ lecciones: [{ estado_procesamiento: "LISTO" }, { estado_procesamiento: "PROCESANDO" }] }],
        }),
        curso("rhino", { destacado: true, orden_visualizacion: 5 }),
      ],
      error: null,
    });
    servidorFalso.responder("from:curso_categorias", { data: [], error: null });
    servidorFalso.responder("from:curso_instructores_publico", { data: [], error: null });
    servidorFalso.responder("rpc:admin_resumen_cursos", {
      data: [
        { id_curso: "revit", empezaron: 41, terminaron: 15, se_quedaron: 9, personas: 27, certificados: 5 },
        { id_curso: null, empezaron: 50, terminaron: 15, se_quedaron: 10, personas: 30, certificados: 5 },
      ],
      error: null,
    });
    servidorFalso.responder("rpc:admin_clases_con_atascos", {
      data: [{ id_leccion: "l8", leccion: "Cubiertas", modulo: "Cubiertas", curso: "Revit", curso_slug: "revit", personas: 4 }],
      error: null,
    });

    const r = await getCursosListado();

    const [revit, mep, rhino] = r.cursos;
    expect(revit).toMatchObject({ enPortada: true, clases: 1, sinVideo: 0, faltas: [], empezaron: 41, terminaron: 15, seQuedaron: 9 });
    expect(mep).toMatchObject({ enPortada: false, clases: 2, sinVideo: 1, empezaron: 0 });
    expect(mep.faltas.map((falta) => falta.corto)).toEqual(["portada", "1 video"]);
    expect(rhino.enPortada).toBe(false);
    expect(r).toMatchObject({ personas: 30, certificados: 5, seQuedaron: 10 });
    expect(r.atascos).toEqual([{ idLeccion: "l8", leccion: "Cubiertas", modulo: "Cubiertas", curso: "Revit", cursoSlug: "revit", personas: 4 }]);
  });

  it("despublicar dice que quien ya lo empezó puede terminarlo", () => {
    expect(textoDespublicar({ empezaron: 0, enPortada: false })).not.toMatch(/terminarlo/);
    expect(textoDespublicar({ empezaron: 3, enPortada: true })).toMatch(/Las 3 personas .* pueden terminarlo.*portada/);
  });

  it("la curva usa solo clases con video, numeradas como en Contenido, y marca la mayor caída", () => {
    const leccion = (titulo: string, estado: string, terminaron: number) =>
      ({ titulo, estadoProcesamiento: estado, terminaron, seQuedaron: 0 }) as never;
    const puntos = puntosDeCurva([
      { titulo: "Primeros pasos", lecciones: [leccion("Intro", "LISTO", 10), leccion("Muros", "LISTO", 9)] },
      { titulo: "Cubiertas", lecciones: [leccion("Sin video", "PROCESANDO", 0), leccion("Techos", "LISTO", 5), leccion("Barandas", "LISTO", 4)] },
    ] as never);
    expect(puntos.map((punto) => punto.numero)).toEqual(["1.1", "1.2", "2.2", "2.3"]);
    expect(mayorCaida(puntos)).toBe(2);
    expect(mayorCaida(puntos.map((punto) => ({ ...punto, terminaron: 3 })))).toBeNull();
  });
});
