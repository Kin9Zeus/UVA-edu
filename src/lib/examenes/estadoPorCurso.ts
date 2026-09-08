import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Estado del examen final de varios cursos para UN estudiante, en dos
 * consultas fijas (no una por curso).
 *
 * Lo usan las pantallas del panel que listan el avance de un estudiante y
 * antes decidían "Completado" solo con el 100% de lecciones. Desde Revf5 eso
 * ya no alcanza: si el curso exige examen y el estudiante no lo aprobó, no
 * tiene certificado, así que el panel no puede decir que lo completó.
 *
 * El estudiante lee esto mismo por otro camino (las columnas
 * `examen_requerido` / `examen_aprobado` de `progreso_cursos_estudiante`, que
 * responden por `auth.uid()`); acá hace falta preguntarlo por un usuario
 * arbitrario, que es algo que solo un administrador puede hacer — y RLS ya lo
 * garantiza: `intentos_examen_select_propio_o_admin` (supabase/sql/067) solo
 * devuelve intentos ajenos a un ADMINISTRADOR.
 */
export type EstadoExamenCurso = { requerido: boolean; aprobado: boolean };

export type EstadoCursoConExamen = "EN_PROGRESO" | "EXAMEN_PENDIENTE" | "COMPLETADO";

export async function getEstadoExamenPorCurso(
  supabase: SupabaseClient,
  cursoIds: string[],
  usuarioId: string,
): Promise<Map<string, EstadoExamenCurso>> {
  const estados = new Map<string, EstadoExamenCurso>();
  if (cursoIds.length === 0) return estados;

  const { data: examenes } = await supabase
    .from("examenes")
    .select("id, id_curso")
    .in("id_curso", cursoIds)
    .eq("publicado", true);

  if (!examenes || examenes.length === 0) return estados;

  const cursoPorExamen = new Map<string, string>();
  for (const examen of examenes) {
    cursoPorExamen.set(examen.id as string, examen.id_curso as string);
    estados.set(examen.id_curso as string, { requerido: true, aprobado: false });
  }

  const { data: aprobados } = await supabase
    .from("intentos_examen")
    .select("id_examen")
    .eq("id_usuario", usuarioId)
    .eq("estado", "APROBADO")
    .in("id_examen", [...cursoPorExamen.keys()]);

  for (const intento of aprobados ?? []) {
    const cursoId = cursoPorExamen.get(intento.id_examen as string);
    if (cursoId) estados.set(cursoId, { requerido: true, aprobado: true });
  }

  return estados;
}

/**
 * La misma regla de "curso completo" que aplica el trigger de certificación
 * (private.curso_esta_completo, supabase/sql/068), en la forma de tres
 * estados que necesita el panel.
 *
 * Un curso sin examen publicado no tiene entrada en el mapa, y entonces el
 * 100% de lecciones basta — igual que antes de que existieran los exámenes.
 */
export function estadoDeCurso(
  porcentajeLecciones: number,
  examen: EstadoExamenCurso | undefined,
): EstadoCursoConExamen {
  if (porcentajeLecciones < 100) return "EN_PROGRESO";
  if (examen?.requerido && !examen.aprobado) return "EXAMEN_PENDIENTE";
  return "COMPLETADO";
}
