import { createClient } from "@/lib/supabase/server";

export type CursoDeInstructor = { id: string; titulo: string; mostrado: boolean };

export type Instructor = {
  id: string;
  nombre: string;
  especialidad: string | null;
  numeroCursos: number;
  numeroEstudiantes: number;
  cursos: CursoDeInstructor[];
};

type FilaInstructor = {
  id: string;
  nombre: string;
  especialidad: string | null;
};

type FilaCurso = {
  id: string;
  titulo: string;
  mostrado: boolean;
  id_instructor: string;
};

/**
 * Instructores como entidad propia (tabla `instructores`). Los cursos y el
 * conteo de estudiantes se agregan aquí en vez de con un `count` anidado
 * porque el listado necesita además la lista completa de cursos para el modal.
 *
 * Un instructor recién creado aparece con 0 cursos: ya no depende de tener
 * cursos asignados para existir, como pasaba cuando se derivaba del texto
 * libre `cursos.instructor`.
 */
export async function getInstructores(): Promise<Instructor[]> {
  const supabase = await createClient();

  const [{ data: instructores }, { data: cursos }, { data: inscripciones }] =
    await Promise.all([
      supabase
        .from("instructores")
        .select("id, nombre, especialidad")
        .order("nombre", { ascending: true }),
      supabase.from("cursos").select("id, titulo, mostrado, id_instructor"),
      supabase.from("inscripciones").select("id_curso"),
    ]);

  const estudiantesPorCurso = new Map<string, number>();
  for (const inscripcion of inscripciones ?? []) {
    estudiantesPorCurso.set(
      inscripcion.id_curso,
      (estudiantesPorCurso.get(inscripcion.id_curso) ?? 0) + 1,
    );
  }

  const cursosPorInstructor = new Map<string, FilaCurso[]>();
  for (const curso of (cursos ?? []) as FilaCurso[]) {
    cursosPorInstructor.set(curso.id_instructor, [
      ...(cursosPorInstructor.get(curso.id_instructor) ?? []),
      curso,
    ]);
  }

  return ((instructores ?? []) as FilaInstructor[]).map((instructor) => {
    const suyos = cursosPorInstructor.get(instructor.id) ?? [];
    return {
      id: instructor.id,
      nombre: instructor.nombre,
      especialidad: instructor.especialidad,
      numeroCursos: suyos.length,
      numeroEstudiantes: suyos.reduce(
        (total, curso) => total + (estudiantesPorCurso.get(curso.id) ?? 0),
        0,
      ),
      cursos: suyos.map((curso) => ({
        id: curso.id,
        titulo: curso.titulo,
        mostrado: curso.mostrado,
      })),
    };
  });
}

/** Lista mínima para poblar el selector del formulario de curso. */
export async function getInstructoresParaSelector(): Promise<
  { id: string; nombre: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructores")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  return (data ?? []) as { id: string; nombre: string }[];
}
