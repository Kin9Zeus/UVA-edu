import { createClient } from "@/lib/supabase/server";

export type CursoDeCategoria = {
  id: string;
  titulo: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  instructorNombre: string;
  totalClases: number;
  imagenPortada: string;
};

export type CategoriaDetalle = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cursos: CursoDeCategoria[];
};

/**
 * Categoría activa junto con sus cursos publicados, para la pantalla
 * "Ver categoría" del catálogo del estudiante.
 */
export async function getCategoriaConCursos(categoriaId: string): Promise<CategoriaDetalle | null> {
  const supabase = await createClient();

  const { data: categoria } = await supabase
    .from("categorias")
    .select("id, nombre, descripcion")
    .eq("id", categoriaId)
    .eq("activo", true)
    .single();

  if (!categoria) return null;

  const { data: cursosRows } = await supabase
    .from("cursos")
    .select(
      "id, titulo, nivel, imagen_portada, orden_visualizacion, instructor:instructores(nombre), modulos(lecciones(id)), curso_categorias!inner(id_categoria)",
    )
    .eq("curso_categorias.id_categoria", categoriaId)
    .eq("mostrado", true)
    .order("orden_visualizacion");

  const cursos: CursoDeCategoria[] = (cursosRows ?? []).map(mapCursoDeCategoria);

  return {
    id: categoria.id,
    nombre: categoria.nombre,
    descripcion: categoria.descripcion,
    cursos,
  };
}

function mapCursoDeCategoria(curso: {
  id: string;
  titulo: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  imagen_portada: string;
  instructor: { nombre: string } | { nombre: string }[] | null;
  modulos: { lecciones: { id: string }[] | null }[] | null;
}): CursoDeCategoria {
  const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;
  const totalClases = (curso.modulos ?? []).reduce(
    (total, modulo) => total + (modulo.lecciones?.length ?? 0),
    0,
  );

  return {
    id: curso.id,
    titulo: curso.titulo,
    nivel: curso.nivel,
    instructorNombre: instructor?.nombre ?? "Sin instructor",
    totalClases,
    imagenPortada: curso.imagen_portada,
  };
}

/**
 * Catálogo completo del estudiante: todas las categorías activas que ya
 * tienen al menos un curso publicado, cada una con sus cursos. Sin
 * agrupación por "ruta" (esa entidad no existe en el esquema): la categoría
 * lista sus cursos directo, igual que la pantalla "Ver categoría".
 */
export async function getCatalogo(): Promise<CategoriaDetalle[]> {
  const supabase = await createClient();

  const { data: categoriasRows } = await supabase
    .from("categorias")
    .select("id, nombre, descripcion")
    .eq("activo", true);

  const { data: cursosRows } = await supabase
    .from("cursos")
    .select(
      "id, titulo, nivel, imagen_portada, orden_visualizacion, instructor:instructores(nombre), modulos(lecciones(id)), curso_categorias(id_categoria)",
    )
    .eq("mostrado", true)
    .order("orden_visualizacion");

  // Un curso puede pertenecer a varias categorías en el esquema, pero el CMS
  // hoy solo asigna una: se agrupa por la primera (ver curso_categorias,
  // auditoría de esquema Bloque 3).
  const cursosPorCategoria = new Map<string, CursoDeCategoria[]>();
  for (const curso of cursosRows ?? []) {
    const idCategoria = curso.curso_categorias?.[0]?.id_categoria;
    if (!idCategoria) continue;
    const lista = cursosPorCategoria.get(idCategoria) ?? [];
    lista.push(mapCursoDeCategoria(curso));
    cursosPorCategoria.set(idCategoria, lista);
  }

  return (categoriasRows ?? [])
    .map((categoria) => ({
      id: categoria.id,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      cursos: cursosPorCategoria.get(categoria.id) ?? [],
    }))
    .filter((categoria) => categoria.cursos.length > 0);
}
