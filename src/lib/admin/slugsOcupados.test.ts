import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugsOcupados } from "@/lib/admin/slugsOcupados";

type Fila = { slug: string; id?: string; id_curso?: string; id_categoria?: string };
type Respuesta = { data: Fila[] | null; error: { message: string } | null };

/**
 * Cliente falso: cada tabla devuelve sus filas filtradas por el prefijo de
 * `like` y por los `neq`, que es todo lo que usa `slugsOcupados`.
 */
function clienteFalso(tablas: Record<string, Fila[]>, fallaEn?: string) {
  return {
    from(tabla: string) {
      const filtros: Array<(fila: Fila) => boolean> = [];
      const consulta = {
        select: () => consulta,
        like(_columna: string, patron: string) {
          const prefijo = patron.replace(/%$/, "");
          filtros.push((fila) => fila.slug.startsWith(prefijo));
          return consulta;
        },
        neq(columna: keyof Fila, valor: string) {
          filtros.push((fila) => fila[columna] !== valor);
          return consulta;
        },
        then(resolver: (r: Respuesta) => void) {
          if (tabla === fallaEn) return resolver({ data: null, error: { message: "fallo" } });
          resolver({ data: (tablas[tabla] ?? []).filter((fila) => filtros.every((f) => f(fila))), error: null });
        },
      };
      return consulta;
    },
  } as unknown as SupabaseClient;
}

const BASE = {
  cursos: [
    { slug: "revit", id: "c1" },
    { slug: "sketchup", id: "c2" },
  ],
  cursos_slugs_anteriores: [
    { slug: "revit-basico", id_curso: "c2" },
    { slug: "revit-desde-cero", id_curso: "c1" },
  ],
};

describe("slugsOcupados", () => {
  it("cuenta los slugs actuales y los anteriores con el mismo prefijo", async () => {
    const ocupados = await slugsOcupados(clienteFalso(BASE), "cursos", "revit");
    expect(ocupados.sort()).toEqual(["revit", "revit-basico", "revit-desde-cero"]);
  });

  it("al editar ignora el slug actual y los anteriores del propio curso", async () => {
    const ocupados = await slugsOcupados(clienteFalso(BASE), "cursos", "revit", "c1");
    // Un slug viejo de OTRO curso sigue reservado; el propio queda libre.
    expect(ocupados).toEqual(["revit-basico"]);
  });

  it("lee el historial de escuelas por id_categoria", async () => {
    const cliente = clienteFalso({
      categorias: [{ slug: "bim", id: "e1" }],
      categorias_slugs_anteriores: [{ slug: "bim-revit", id_categoria: "e2" }],
    });
    expect((await slugsOcupados(cliente, "categorias", "bim", "e1"))).toEqual(["bim-revit"]);
  });

  it("si falla la lectura del historial lanza en vez de dar el slug por libre", async () => {
    await expect(
      slugsOcupados(clienteFalso(BASE, "cursos_slugs_anteriores"), "cursos", "revit"),
    ).rejects.toThrow();
  });
});
