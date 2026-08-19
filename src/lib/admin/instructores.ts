import { createClient } from "@/lib/supabase/server";

export type CursoDeInstructor = { id: string; titulo: string; mostrado: boolean };

export type Instructor = {
  nombre: string;
  numeroCursos: number;
  numeroEstudiantes: number;
  cursos: CursoDeInstructor[];
};

/**
 * No existe una tabla Instructores en el esquema (ver decisión registrada en
 * la conversación que creó este panel): Cursos.instructor es texto libre, así
 * que esta vista se deriva agrupando cursos por ese campo en vez de tener
 * entidad propia. Por eso no hay "especialidad", "creado por" ni botón
 * "+ Nuevo instructor" — un instructor solo existe en tanto tenga cursos
 * asignados.
 */
export async function getInstructores(): Promise<Instructor[]> {
  const supabase = await createClient();

  const [{ data: cursos }, { data: inscripciones }] = await Promise.all([
    supabase.from("cursos").select("id, titulo, instructor, mostrado"),
    supabase.from("inscripciones").select("id_curso"),
  ]);

  const estudiantesPorCurso = new Map<string, number>();
  for (const inscripcion of inscripciones ?? []) {
    estudiantesPorCurso.set(inscripcion.id_curso, (estudiantesPorCurso.get(inscripcion.id_curso) ?? 0) + 1);
  }

  const porInstructor = new Map<string, Instructor>();
  for (const curso of cursos ?? []) {
    const actual: Instructor = porInstructor.get(curso.instructor) ?? {
      nombre: curso.instructor,
      numeroCursos: 0,
      numeroEstudiantes: 0,
      cursos: [],
    };
    actual.numeroCursos += 1;
    actual.numeroEstudiantes += estudiantesPorCurso.get(curso.id) ?? 0;
    actual.cursos.push({ id: curso.id, titulo: curso.titulo, mostrado: curso.mostrado });
    porInstructor.set(curso.instructor, actual);
  }

  return Array.from(porInstructor.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}
