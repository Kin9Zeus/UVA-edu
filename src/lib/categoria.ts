import { createClient } from "@/lib/supabase/server";

export type CursoDeCategoria = {
  id: string;
  titulo: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  instructorNombre: string;
  categoriaNombre: string;
  totalClases: number;
  imagenPortada: string;
};

export type CategoriaActiva = { id: string; slug: string; nombre: string };

export type CategoriaInfo = { id: string; slug: string; nombre: string; descripcion: string | null };

export type ResultadoCatalogo = {
  cursos: CursoDeCategoria[];
  totalResultados: number;
  pagina: number;
  totalPaginas: number;
};

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CURSOS_POR_PAGINA = 12;

/** Categorías activas para el selector de filtro del catálogo. */
export async function getCategoriasActivas(): Promise<CategoriaActiva[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categorias").select("id, slug, nombre").eq("activo", true).order("nombre");
  return (data ?? []) as CategoriaActiva[];
}

/**
 * Resuelve una categoría por slug o UUID (los enlaces anteriores al cambio
 * de rutas siguen resolviendo por UUID), sin traer sus cursos — eso lo
 * resuelve buscarCatalogo() por separado, ya paginado y filtrado.
 */
export async function resolverCategoria(identificador: string): Promise<CategoriaInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, slug, nombre, descripcion")
    .eq(PATRON_UUID.test(identificador) ? "id" : "slug", identificador)
    .eq("activo", true)
    .maybeSingle();
  return data as CategoriaInfo | null;
}

/**
 * Revf3 ("Catálogo con búsqueda por palabra clave y filtro por categoría"):
 * la búsqueda, el filtro y la paginación se resuelven en Postgres —
 * `buscar_catalogo` (supabase/sql/034_busqueda_catalogo.sql) usa un índice
 * de trigramas insensible a tildes, no un `.filter()` sobre todo el
 * catálogo traído al cliente.
 */
export async function buscarCatalogo(opciones: {
  query?: string;
  categoriaId?: string;
  pagina?: number;
}): Promise<ResultadoCatalogo> {
  const supabase = await createClient();
  const pagina = Math.max(1, Math.floor(opciones.pagina ?? 1) || 1);
  const offset = (pagina - 1) * CURSOS_POR_PAGINA;

  const { data, error } = await supabase.rpc("buscar_catalogo", {
    p_query: opciones.query?.trim() || null,
    p_categoria_id: opciones.categoriaId || null,
    p_limite: CURSOS_POR_PAGINA,
    p_offset: offset,
  });

  if (error || !data) {
    return { cursos: [], totalResultados: 0, pagina, totalPaginas: 1 };
  }

  type FilaBusqueda = {
    curso_id: string;
    titulo: string;
    nivel: CursoDeCategoria["nivel"];
    imagen_portada: string;
    instructor_nombre: string | null;
    categoria_nombre: string | null;
    total_clases: number;
    total_resultados: number;
  };

  const filas = data as FilaBusqueda[];
  const totalResultados = filas[0]?.total_resultados ?? 0;

  const cursos: CursoDeCategoria[] = filas.map((fila) => ({
    id: fila.curso_id,
    titulo: fila.titulo,
    nivel: fila.nivel,
    instructorNombre: fila.instructor_nombre ?? "Sin instructor",
    categoriaNombre: fila.categoria_nombre ?? "General",
    totalClases: Number(fila.total_clases),
    imagenPortada: fila.imagen_portada,
  }));

  return {
    cursos,
    totalResultados,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(totalResultados / CURSOS_POR_PAGINA)),
  };
}

export type CursoOpcionBuscador = {
  id: string;
  titulo: string;
  instructorNombre: string;
};

/**
 * Listado liviano (sin imagen ni temario) de todos los cursos publicados,
 * para alimentar el dropdown de sugerencias del buscador (que resalta
 * coincidencias mientras se escribe, sin disparar una consulta al
 * servidor por tecla — ver BuscadorInput.tsx). Se pide una sola vez y se
 * cachea en el cliente — ver src/actions/cursos/buscador.ts.
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
