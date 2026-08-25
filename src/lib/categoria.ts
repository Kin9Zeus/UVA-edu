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
  slug: string;
  nombre: string;
  descripcion: string | null;
  cursos: CursoDeCategoria[];
};

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Categoría activa junto con sus cursos publicados, para la pantalla
 * "Ver categoría" del catálogo del estudiante.
 *
 * `identificador` es el slug (lo que la app pone en la URL desde que existe
 * `categorias.slug`) o el UUID: los enlaces viejos, compartidos antes del
 * cambio de rutas, siguen resolviendo en vez de dar 404.
 */
export async function getCategoriaConCursos(identificador: string): Promise<CategoriaDetalle | null> {
  const supabase = await createClient();

  const { data: categoria } = await supabase
    .from("categorias")
    .select("id, slug, nombre, descripcion")
    .eq(PATRON_UUID.test(identificador) ? "id" : "slug", identificador)
    .eq("activo", true)
    .maybeSingle();

  if (!categoria) return null;

  const categoriaId = categoria.id;

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
    slug: categoria.slug,
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

export type CursoOpcionBuscador = {
  id: string;
  titulo: string;
  instructorNombre: string;
};

/**
 * Listado liviano (sin imagen ni temario) de todos los cursos publicados,
 * para alimentar el dropdown de sugerencias del buscador de los headers
 * (que no reciben el catálogo completo como prop). Se pide una sola vez y
 * se cachea en el cliente — ver src/actions/cursos/buscador.ts.
 */
export async function getCursosParaBuscador(): Promise<CursoOpcionBuscador[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cursos")
    .select("id, titulo, instructor:instructores(nombre)")
    .eq("mostrado", true)
    .order("titulo");

  return (data ?? []).map((curso) => {
    const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;
    return {
      id: curso.id,
      titulo: curso.titulo,
      instructorNombre: instructor?.nombre ?? "Sin instructor",
    };
  });
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
    .select("id, slug, nombre, descripcion")
    .eq("activo", true);

  const { data: cursosRows } = await supabase
    .from("cursos")
    .select(
      "id, titulo, nivel, imagen_portada, orden_visualizacion, instructor:instructores(nombre), modulos(lecciones(id)), curso_categorias(id_categoria)",
    )
    .eq("mostrado", true)
    .order("orden_visualizacion");

  // Un curso aparece bajo cada una de sus categorías, no solo bajo la
  // primera: `curso_categorias` es muchos-a-muchos y el CMS ya permite
  // asignar varias.
  const cursosPorCategoria = new Map<string, CursoDeCategoria[]>();
  for (const curso of cursosRows ?? []) {
    const mapeado = mapCursoDeCategoria(curso);
    for (const { id_categoria: idCategoria } of curso.curso_categorias ?? []) {
      const lista = cursosPorCategoria.get(idCategoria) ?? [];
      lista.push(mapeado);
      cursosPorCategoria.set(idCategoria, lista);
    }
  }

  return (categoriasRows ?? [])
    .map((categoria) => ({
      id: categoria.id,
      slug: categoria.slug,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      cursos: cursosPorCategoria.get(categoria.id) ?? [],
    }))
    .filter((categoria) => categoria.cursos.length > 0);
}
