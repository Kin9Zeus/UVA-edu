import { createClient } from "@/lib/supabase/server";

export type CursoListado = {
  id: string;
  titulo: string;
  /** Todas las categorías del curso: `curso_categorias` es muchos-a-muchos. */
  categorias: { id: string; nombre: string }[];
  instructor: string;
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
      .select("id, titulo, nivel, mostrado, fecha_creacion:creado_en, instructor:instructores(nombre)")
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

  return (cursos ?? []).map((curso) => {
    const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;
    return {
      id: curso.id,
      titulo: curso.titulo,
      categorias: categoriasPorCurso.get(curso.id) ?? [],
      instructor: instructor?.nombre ?? "Sin instructor",
      nivel: curso.nivel,
      estudiantes: conteo.get(curso.id) ?? 0,
      mostrado: curso.mostrado,
      fechaCreacion: curso.fecha_creacion,
    };
  });
}

export async function getCategoriasActivas() {
  const supabase = await createClient();
  const { data } = await supabase.from("categorias").select("id, nombre").eq("activo", true).order("nombre");
  return data ?? [];
}

// getInstructoresSugeridos() desapareció al pasar los instructores a tabla
// propia: ya no hay que deducirlos de los cursos existentes. El formulario
// usa getInstructoresParaSelector() de @/lib/admin/instructores.
