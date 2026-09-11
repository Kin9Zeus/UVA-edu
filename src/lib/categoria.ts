import { createClient } from "@/lib/supabase/server";
import { getInstructoresDeCursos, nombresDeInstructores, SIN_INSTRUCTOR } from "@/lib/instructores";
import { esUuid } from "@/lib/slug";

/** Chip de categoría reutilizado por el catálogo y por "Tu progreso" (lib/progreso.ts). */
export type CategoriaChip = { id: string; nombre: string };

export type CursoDeCategoria = {
  id: string;
  slug: string;
  titulo: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  /**
   * Los profesores del curso en una sola línea ("Ana Ruiz, Daniel Castaño").
   * La tarjeta del catálogo tiene una línea truncada para esto, no una ficha
   * por persona, así que se agrega en SQL (`string_agg` dentro de
   * `buscar_catalogo`) y llega ya formateado: una fila por curso, sin una
   * segunda consulta ni un fan-out que rompería la paginación.
   */
  instructorNombre: string;
  /** Todas las categorías del curso — `curso_categorias` es muchos-a-muchos (ver 059). */
  categorias: CategoriaChip[];
  totalClases: number;
  imagenPortada: string;
  /**
   * `true` solo cuando `buscarCatalogo({ incluirProgreso: true })` lo pidió
   * (el catálogo del dashboard) y el estudiante ya completó el 100% de las
   * lecciones LISTAS del curso Y, si el curso exige examen final, lo aprobó
   * (Revf5 — mismo criterio que decide la emisión del certificado, ver
   * lib/progreso.ts). En el catálogo público siempre queda `undefined` — ver
   * buscarCatalogo().
   */
  completado?: boolean;
  /**
   * `true` cuando terminó el 100% de las clases pero el curso exige examen
   * final y todavía no lo aprobó — el tercer estado de "Tu progreso"
   * (ProgresoContent.tsx). `undefined` en las mismas condiciones que
   * `completado`.
   */
  examenPendiente?: boolean;
};

export type CategoriaActiva = { id: string; slug: string; nombre: string };

export type CategoriaInfo = { id: string; slug: string; nombre: string; descripcion: string | null };

export type ResultadoCatalogo = {
  cursos: CursoDeCategoria[];
  totalResultados: number;
  pagina: number;
  totalPaginas: number;
};

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
    .eq(esUuid(identificador) ? "id" : "slug", identificador)
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
  /**
   * Solo el catálogo del dashboard del estudiante lo pasa en `true`. La
   * fuente es `progreso_cursos_estudiante` (033), otorgada nada más a
   * `authenticated` — pedirla desde el catálogo público (anon) fallaría con
   * un error de permisos, así que el default es no consultarla.
   */
  incluirProgreso?: boolean;
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
    curso_slug: string;
    titulo: string;
    nivel: CursoDeCategoria["nivel"];
    imagen_portada: string;
    instructor_nombre: string | null;
    categorias: CategoriaChip[] | null;
    total_clases: number;
    total_resultados: number;
  };

  const filas = data as FilaBusqueda[];
  const totalResultados = filas[0]?.total_resultados ?? 0;

  const progresoPorCurso = opciones.incluirProgreso
    ? await getProgresoPorCurso(
        supabase,
        filas.map((fila) => fila.curso_id),
      )
    : null;

  const cursos: CursoDeCategoria[] = filas.map((fila) => ({
    id: fila.curso_id,
    slug: fila.curso_slug,
    titulo: fila.titulo,
    nivel: fila.nivel,
    instructorNombre: fila.instructor_nombre ?? SIN_INSTRUCTOR,
    categorias: fila.categorias?.length ? fila.categorias : [{ id: "general", nombre: "General" }],
    totalClases: Number(fila.total_clases),
    imagenPortada: fila.imagen_portada,
    completado: progresoPorCurso?.get(fila.curso_id)?.completado,
    examenPendiente: progresoPorCurso?.get(fila.curso_id)?.examenPendiente,
  }));

  return {
    cursos,
    totalResultados,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(totalResultados / CURSOS_POR_PAGINA)),
  };
}

/**
 * `curso_id -> {completado, examenPendiente}` para el catálogo del
 * dashboard (033/078). Solo trae las filas de los cursos de esta página, no
 * todo el progreso del estudiante. Un curso que el estudiante nunca tocó no
 * tiene fila en la vista — el `Map` simplemente no lo incluye, y `.get()`
 * devuelve `undefined`, que en CursoCard se trata igual que `false`.
 *
 * Mismo criterio que getProgresoData() (lib/progreso.ts): el 100% de
 * lecciones no basta si el curso exige examen final y no está aprobado
 * (Revf5) — antes esta función solo miraba lecciones y la tarjeta del
 * catálogo podía decir "Completado" en un curso con el examen pendiente.
 */
async function getProgresoPorCurso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cursoIds: string[],
): Promise<Map<string, { completado: boolean; examenPendiente: boolean }>> {
  const progresoPorCurso = new Map<string, { completado: boolean; examenPendiente: boolean }>();
  if (cursoIds.length === 0) return progresoPorCurso;

  const { data } = await supabase
    .from("progreso_cursos_estudiante")
    .select("curso_id, lecciones_total, lecciones_completadas, examen_requerido, examen_aprobado")
    .in("curso_id", cursoIds);

  for (const fila of data ?? []) {
    const total = fila.lecciones_total as number;
    const completadas = fila.lecciones_completadas as number;
    const cienPorCiento = total > 0 && completadas >= total;
    const examenRequerido = fila.examen_requerido === true;
    const examenAprobado = fila.examen_aprobado === true;

    progresoPorCurso.set(fila.curso_id as string, {
      completado: cienPorCiento && (!examenRequerido || examenAprobado),
      examenPendiente: cienPorCiento && examenRequerido && !examenAprobado,
    });
  }
  return progresoPorCurso;
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
    .select("id, titulo")
    .eq("mostrado", true)
    .order("titulo");

  const cursos = data ?? [];
  // Dos consultas fijas, no una por curso: el nombre del profesor ya no se
  // puede embeber en el `.select()` de arriba porque vive en `perfiles`, que
  // RLS no le abre a un visitante sin sesión (ver lib/instructores.ts).
  const instructoresPorCurso = await getInstructoresDeCursos(
    supabase,
    cursos.map((curso) => curso.id as string),
  );

  return cursos.map((curso) => ({
    id: curso.id,
    titulo: curso.titulo,
    instructorNombre: nombresDeInstructores(instructoresPorCurso.get(curso.id) ?? []),
  }));
}
