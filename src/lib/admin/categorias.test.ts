import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { getCategorias } = await import("./categorias");
const { seVeEnCatalogo } = await import("@/components/admin/categorias/EstadoEnCatalogo");

beforeEach(() => servidorFalso.reiniciar());

const curso = (id: string, mostrado: boolean) => ({ id, slug: id, titulo: id, mostrado });

describe("getCategorias", () => {
  it("cuenta publicados y borradores por categoría, el total sin repetir y el estudio de la RPC", async () => {
    servidorFalso.responder("from:categorias", {
      data: [
        { id: "bim", slug: "bim", nombre: "BIM", descripcion: null, activo: true },
        { id: "urb", slug: "urb", nombre: "Urbanismo", descripcion: null, activo: true },
      ],
      error: null,
    });
    servidorFalso.responder("from:curso_categorias", {
      data: [
        { id_categoria: "bim", curso: curso("revit", true) },
        { id_categoria: "bim", curso: curso("mep", false) },
        // El mismo curso en dos categorías cuenta una vez en el total.
        { id_categoria: "urb", curso: curso("revit", true) },
      ],
      error: null,
    });
    servidorFalso.responder("rpc:admin_estudio_por_categoria", {
      data: [
        { id_categoria: "bim", personas: 5, certificados: 2 },
        { id_categoria: null, personas: 7, certificados: 2 },
      ],
      error: null,
    });

    const r = await getCategorias();

    expect(r.categorias.map(({ id, publicados, borradores, personas, certificados }) => ({ id, publicados, borradores, personas, certificados }))).toEqual([
      { id: "bim", publicados: 1, borradores: 1, personas: 5, certificados: 2 },
      { id: "urb", publicados: 1, borradores: 0, personas: 0, certificados: 0 },
    ]);
    expect(r).toMatchObject({ cursosPublicados: 1, cursosBorrador: 1, personas: 7, certificados: 2 });
  });

  it("se ve en el catálogo solo encendida y con un curso publicado", () => {
    expect(seVeEnCatalogo({ activo: true, publicados: 1 })).toBe(true);
    expect(seVeEnCatalogo({ activo: true, publicados: 0 })).toBe(false);
    expect(seVeEnCatalogo({ activo: false, publicados: 3 })).toBe(false);
  });
});
