import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";
import { lanzarSiFalla } from "@/lib/supabase/errores";

/**
 * Quién dicta un curso. Es una cuenta real (`perfiles` con rol PROFESOR), no
 * una ficha de catálogo: instructor y profesor son la misma entidad desde la
 * migración `20260903000000_multi_instructores`.
 */
export type InstructorPublico = {
  id: string;
  nombre: string;
  especialidad: string | null;
  fotoUrl: string | null;
};

/** Nombre que se muestra cuando un curso todavía no tiene profesor asignado. */
export const SIN_INSTRUCTOR = "Sin instructor";

/**
 * Los instructores de varios cursos de una sola consulta, agrupados por curso.
 *
 * Lee `curso_instructores_publico` (supabase/sql/053_curso_instructores.sql) y
 * NUNCA `perfiles` directo. Esa vista es la única puerta pública a los datos
 * de un profesor: proyecta solo `nombre` y `especialidad`, dejando fuera
 * `correo`, `celular`, `estado` y `rol`. RLS de Postgres es por fila, no por
 * columna, así que abrir la fila de `perfiles` a `anon` —que es lo que haría
 * un embed de PostgREST hacia `perfiles`— filtraría también esos campos.
 *
 * La vista aplica por su cuenta el mismo criterio de visibilidad que la policy
 * `curso_instructores_select_publico` (curso publicado, o administrador, o
 * acceso vigente a un curso despublicado), así que sirve igual al catálogo
 * anónimo y al panel de administración: no hace falta una segunda variante.
 *
 * Una sola consulta con `.in()` para N cursos, nunca una por curso — es el
 * problema N+1 que el resto de `lib/` ya evita explícitamente.
 *
 * `estricto`: lanza si la consulta falla, en vez de devolver el mapa vacío.
 * Lo pide quien guarda el resultado en caché (`getCursosParaBuscador`, en
 * lib/categoria.ts): un mapa vacío ahí quedaría cacheado y mostraría todos
 * los cursos como "Sin instructor" durante minutos (AUDIT-2026-09-22.md,
 * P2-2). Sin él, se conserva el comportamiento de siempre para el panel.
 */
export async function getInstructoresDeCursos(
  supabase: SupabaseClient,
  cursoIds: string[],
  { estricto = false }: { estricto?: boolean } = {},
): Promise<Map<string, InstructorPublico[]>> {
  const porCurso = new Map<string, InstructorPublico[]>();
  if (cursoIds.length === 0) return porCurso;

  const { data, error } = await supabase
    .from("curso_instructores_publico")
    .select("id_curso, id_instructor, nombre, especialidad, foto_url")
    .in("id_curso", cursoIds);

  // Una consulta rechazada devuelve `data: null`: los cursos saldrían como
  // "Sin instructor". Antes eso pasaba sin dejar rastro; ahora, o lanza
  // (`estricto`, y quien llama lo registra) o se registra aquí y degrada igual
  // que antes.
  if (error) {
    if (estricto) lanzarSiFalla(error, "curso_instructores_publico");
    logError("instructores", "no se pudieron leer los instructores de los cursos", error, {
      area: "catalogo",
      cursos: cursoIds.length,
    });
    return porCurso;
  }

  for (const fila of data ?? []) {
    const lista = porCurso.get(fila.id_curso as string) ?? [];
    lista.push({
      id: fila.id_instructor as string,
      nombre: fila.nombre as string,
      especialidad: (fila.especialidad as string | null) ?? null,
      fotoUrl: (fila.foto_url as string | null) ?? null,
    });
    porCurso.set(fila.id_curso as string, lista);
  }

  // El orden de las filas no lo garantiza PostgREST sin un ORDER BY explícito,
  // y aquí importa: es el orden en que se listan los profesores en la ficha
  // del curso y en la tarjeta del catálogo.
  for (const lista of porCurso.values()) {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  return porCurso;
}

/** Los instructores de UN curso, ya ordenados. Atajo sobre la función de arriba. */
export async function getInstructoresDeCurso(
  supabase: SupabaseClient,
  cursoId: string,
): Promise<InstructorPublico[]> {
  const porCurso = await getInstructoresDeCursos(supabase, [cursoId]);
  return porCurso.get(cursoId) ?? [];
}

/**
 * "Ana Ruiz, Daniel Castaño" para los sitios que muestran el instructor como
 * una línea de texto (tarjeta del catálogo, tabla del panel, dropdown del
 * buscador). Donde el diseño da espacio para una ficha por persona —la
 * tarjeta de "quién dicta el curso"— se itera sobre el array en vez de usar
 * esto.
 */
export function nombresDeInstructores(instructores: { nombre: string }[]): string {
  if (instructores.length === 0) return SIN_INSTRUCTOR;
  return instructores.map((instructor) => instructor.nombre).join(", ");
}
