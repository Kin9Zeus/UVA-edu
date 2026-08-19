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

  const [{ data: cursos }, { data: inscripciones }] = await Promise.all([
    supabase
      .from("cursos")
      .select(
        "id, titulo, nivel, mostrado, fecha_creacion, id_categoria, categoria:categorias(nombre), instructor:instructores(nombre)",
      )
      .order("fecha_creacion", { ascending: false }),
    supabase.from("inscripciones").select("id_curso"),
  ]);

  const conteo = new Map<string, number>();
  for (const inscripcion of inscripciones ?? []) {
    conteo.set(inscripcion.id_curso, (conteo.get(inscripcion.id_curso) ?? 0) + 1);
  }

  return (cursos ?? []).map((curso) => {
    const categoria = Array.isArray(curso.categoria) ? curso.categoria[0] : curso.categoria;
    const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;
    return {
      id: curso.id,
      titulo: curso.titulo,
      categoria: categoria?.nombre ?? "Sin categoría",
      categoriaId: curso.id_categoria,
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
