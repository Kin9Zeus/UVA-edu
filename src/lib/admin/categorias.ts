import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";

export type CursoDeCategoria = { id: string; slug: string; titulo: string; mostrado: boolean };

export type Categoria = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  publicados: number;
  borradores: number;
  cursos: CursoDeCategoria[];
  /** Personas que tocaron una clase de sus cursos en los últimos 30 días. */
  personas: number;
  /** Certificados de sus cursos emitidos en los últimos 30 días. */
  certificados: number;
};

export type ResumenCategorias = {
  categorias: Categoria[];
  /** Cursos publicados sin repetir: un curso puede estar en dos categorías. */
  cursosPublicados: number;
  cursosBorrador: number;
  /** Totales de 30 días sin repetir (la fila total de la RPC). */
  personas: number;
  certificados: number;
};

export const DIAS_ESTUDIO_CATEGORIAS = 30;

type FilaCategoria = { id: string; slug: string; nombre: string; descripcion: string | null; activo: boolean };
type FilaEstudio = { id_categoria: string | null; personas: number; certificados: number };

export async function getCategorias(): Promise<ResumenCategorias> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - DIAS_ESTUDIO_CATEGORIAS * 86_400_000).toISOString();

  const [{ data: categorias, error: errorCategorias }, { data: filasCursos, error: errorCursos }, { data: estudio, error: errorEstudio }] =
    await Promise.all([
      supabase.from("categorias").select("id, slug, nombre, descripcion, activo").order("nombre", { ascending: true }),
      supabase.from("curso_categorias").select("id_categoria, curso:cursos(id, slug, titulo, mostrado)"),
      supabase.rpc("admin_estudio_por_categoria", { p_desde: desde }),
    ]);
  lanzarSiFalla(errorCategorias, "categorias:categorias");
  lanzarSiFalla(errorCursos, "categorias:curso_categorias");
  lanzarSiFalla(errorEstudio, "categorias:admin_estudio_por_categoria");

  const cursosPorCategoria = new Map<string, CursoDeCategoria[]>();
  const publicados = new Set<string>();
  const borradores = new Set<string>();
  for (const fila of filasCursos ?? []) {
    const curso = Array.isArray(fila.curso) ? fila.curso[0] : fila.curso;
    if (!curso) continue;
    cursosPorCategoria.set(fila.id_categoria, [...(cursosPorCategoria.get(fila.id_categoria) ?? []), curso]);
    (curso.mostrado ? publicados : borradores).add(curso.id);
  }

  const estudioPorCategoria = new Map<string | null, FilaEstudio>(
    ((estudio ?? []) as FilaEstudio[]).map((fila) => [fila.id_categoria, fila]),
  );
  const total = estudioPorCategoria.get(null);

  return {
    categorias: ((categorias ?? []) as FilaCategoria[]).map((categoria) => {
      const suyos = cursosPorCategoria.get(categoria.id) ?? [];
      const suEstudio = estudioPorCategoria.get(categoria.id);
      return {
        ...categoria,
        publicados: suyos.filter((curso) => curso.mostrado).length,
        borradores: suyos.filter((curso) => !curso.mostrado).length,
        cursos: suyos,
        personas: Number(suEstudio?.personas ?? 0),
        certificados: Number(suEstudio?.certificados ?? 0),
      };
    }),
    cursosPublicados: publicados.size,
    cursosBorrador: borradores.size,
    personas: Number(total?.personas ?? 0),
    certificados: Number(total?.certificados ?? 0),
  };
}
