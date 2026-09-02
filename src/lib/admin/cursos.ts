import { createClient } from "@/lib/supabase/server";
import { getInstructoresDeCursos, type InstructorPublico } from "@/lib/instructores";

export type CursoListado = {
  id: string;
  titulo: string;
  /** Todas las categorías del curso: `curso_categorias` es muchos-a-muchos. */
  categorias: { id: string; nombre: string }[];
  /** Todos los profesores del curso: `curso_instructores` es muchos-a-muchos. */
  instructores: InstructorPublico[];
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  estudiantes: number;
  mostrado: boolean;
  fechaCreacion: string;
};

export async function getCursosListado(): Promise<CursoListado[]> {
  const supabase = await createClient();

  const [{ data: cursos }, { data: inscripciones }, { data: categoriasDeCursos }] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, titulo, nivel, mostrado, fecha_creacion:creado_en")
      .order("creado_en", { ascending: false }),
    supabase.from("inscripciones").select("id_curso"),
    supabase.from("curso_categorias").select("id_curso, id_categoria, categoria:categorias(nombre)"),
  ]);

  const conteo = new Map<string, number>();
  for (const inscripcion of inscripciones ?? []) {
    conteo.set(inscripcion.id_curso, (conteo.get(inscripcion.id_curso) ?? 0) + 1);
  }

  // Se agrupan TODAS las categorías de cada curso, no solo la primera: el
  // listado las muestra completas y el filtro por categoría tiene que
  // encontrar un curso también cuando esa categoría es la segunda o la
  // tercera que tiene asignada.
  const categoriasPorCurso = new Map<string, { id: string; nombre: string }[]>();
  for (const fila of categoriasDeCursos ?? []) {
    const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
    const lista = categoriasPorCurso.get(fila.id_curso) ?? [];
    lista.push({ id: fila.id_categoria, nombre: categoria?.nombre ?? "Sin categoría" });
    categoriasPorCurso.set(fila.id_curso, lista);
  }
  for (const lista of categoriasPorCurso.values()) {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  // Una sola consulta para los profesores de todo el listado. La vista
  // `curso_instructores_publico` también deja pasar los cursos en borrador
  // cuando quien consulta es administrador (private.es_administrador() está en
  // su WHERE), así que sirve igual acá que en el catálogo público.
  const instructoresPorCurso = await getInstructoresDeCursos(
    supabase,
    (cursos ?? []).map((curso) => curso.id as string),
  );

  return (cursos ?? []).map((curso) => ({
    id: curso.id,
    titulo: curso.titulo,
    categorias: categoriasPorCurso.get(curso.id) ?? [],
    instructores: instructoresPorCurso.get(curso.id) ?? [],
    nivel: curso.nivel,
    estudiantes: conteo.get(curso.id) ?? 0,
    mostrado: curso.mostrado,
    fechaCreacion: curso.fecha_creacion,
  }));
}

export async function getCategoriasActivas() {
  const supabase = await createClient();
  const { data } = await supabase.from("categorias").select("id, nombre").eq("activo", true).order("nombre");
  return data ?? [];
}

// El selector de instructores del formulario de curso usa
// getPerfilesProfesor() de @/lib/admin/profesores: son cuentas reales con rol
// PROFESOR, no fichas de una tabla de catálogo. `lib/admin/instructores.ts`
// (y con él getInstructoresParaSelector) se eliminó en la migración
// `20260903000000_multi_instructores`.
