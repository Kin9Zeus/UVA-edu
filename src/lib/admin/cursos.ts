import { createClient } from "@/lib/supabase/server";

export type CursoListado = {
  id: string;
  titulo: string;
  categoria: string;
  categoriaId: string;
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

  // El CMS solo maneja una categoría por curso hoy: se toma la primera fila
  // de la puente por curso (ver curso_categorias, auditoría de esquema
  // Bloque 3).
  const categoriaPorCurso = new Map<string, { id: string; nombre: string }>();
  for (const fila of categoriasDeCursos ?? []) {
    if (categoriaPorCurso.has(fila.id_curso)) continue;
    const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
    categoriaPorCurso.set(fila.id_curso, { id: fila.id_categoria, nombre: categoria?.nombre ?? "Sin categoría" });
  }

  return (cursos ?? []).map((curso) => {
    const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;
    const categoria = categoriaPorCurso.get(curso.id);
    return {
      id: curso.id,
      titulo: curso.titulo,
      categoria: categoria?.nombre ?? "Sin categoría",
      categoriaId: categoria?.id ?? "",
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
