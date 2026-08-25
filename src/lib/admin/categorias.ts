import { createClient } from "@/lib/supabase/server";

export type CursoDeCategoria = { id: string; titulo: string; mostrado: boolean };

export type Categoria = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoPor: string;
  numeroCursos: number;
  cursos: CursoDeCategoria[];
};

type FilaCategoria = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  admin_creador: { nombre: string } | { nombre: string }[] | null;
};

type FilaCurso = {
  id: string;
  titulo: string;
  mostrado: boolean;
  id_categoria: string;
};

export async function getCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();

  const [{ data: categorias }, { data: cursosPorCategoriaRows }] = await Promise.all([
    supabase
      .from("categorias")
      .select("id, slug, nombre, descripcion, activo, admin_creador:perfiles(nombre)")
      .order("nombre", { ascending: true }),
    supabase.from("curso_categorias").select("id_categoria, curso:cursos(id, titulo, mostrado)"),
  ]);

  const cursosPorCategoria = new Map<string, FilaCurso[]>();
  for (const fila of cursosPorCategoriaRows ?? []) {
    const curso = Array.isArray(fila.curso) ? fila.curso[0] : fila.curso;
    if (!curso) continue;
    cursosPorCategoria.set(fila.id_categoria, [
      ...(cursosPorCategoria.get(fila.id_categoria) ?? []),
      { ...curso, id_categoria: fila.id_categoria },
    ]);
  }

  return ((categorias ?? []) as FilaCategoria[]).map((categoria) => {
    const adminCreador = Array.isArray(categoria.admin_creador)
      ? categoria.admin_creador[0]
      : categoria.admin_creador;
    const suyos = cursosPorCategoria.get(categoria.id) ?? [];

    return {
      id: categoria.id,
      slug: categoria.slug,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      activo: categoria.activo,
      creadoPor: adminCreador?.nombre ?? "—",
      numeroCursos: suyos.length,
      cursos: suyos.map((curso) => ({
        id: curso.id,
        titulo: curso.titulo,
        mostrado: curso.mostrado,
      })),
    };
  });
}
