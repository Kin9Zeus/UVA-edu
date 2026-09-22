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
 * (private.curso_esta_completo, supabase/sql/114_certificado_no_exige_lecciones.sql),
 * en la forma de tres estados que necesita el panel.
 *
 * Un curso sin examen publicado no tiene entrada en el mapa, y entonces el
 * 100% de lecciones sigue siendo lo único que exige — igual que antes de que
 * existieran los exámenes.
 *
 * CUANDO EL CURSO EXIGE EXAMEN, APROBARLO BASTA (Revf6)
 * ------------------------------------------------------
 * Antes de este cambio, aprobar el examen sin haber visto el 100% de las
 * clases dejaba el curso en "EN_PROGRESO" — un estudiante podía aprobar el
 * examen y el panel de admin (lista de estudiantes, detalle de usuario) no
 * reflejaba nada de eso hasta que también terminara el temario. Decisión de
 * producto: el examen YA se puede rendir sin ver ninguna lección
 * (`src/lib/examen.ts`, "acceso libre"), así que negarle la certificación por
 * las clases era una regla a medias — exigía el examen en un extremo del
 * flujo y las lecciones en el otro. Ahora basta con aprobar el examen.
 */
export function estadoDeCurso(
  porcentajeLecciones: number,
  examen: EstadoExamenCurso | undefined,
): EstadoCursoConExamen {
  if (examen?.requerido) {
    if (examen.aprobado) return "COMPLETADO";
    return porcentajeLecciones < 100 ? "EN_PROGRESO" : "EXAMEN_PENDIENTE";
  }
  return porcentajeLecciones < 100 ? "EN_PROGRESO" : "COMPLETADO";
}

/**
 * Porcentaje de lecciones vistas, el que alimenta a `estadoDeCurso` y a
 * `porcentajeMostrado`. Todas las pantallas lo calculan con esta función
 * para que "100%" signifique lo mismo en todas.
 *
 * Hacia abajo, no al más cercano: con `Math.round`, 199 de 200 clases daba
 * 100 (99.5 redondeado) y `estadoDeCurso` marcaba COMPLETADO un curso sin
 * examen al que todavía le faltaba una clase. El 100 solo sale con todas.
 */
export function porcentajeLecciones(completadas: number, total: number): number {
  return total > 0 ? Math.floor((completadas / total) * 100) : 0;
}

/**
 * El porcentaje que se MUESTRA junto al estado (barra de progreso del
 * dashboard del estudiante, columna "Progreso" de `EstudiantesTab.tsx`,
 * barra de `UsuarioDetalleView.tsx`) — no siempre el de lecciones vistas.
 *
 * Sin esto, un curso con el examen aprobado a medio temario quedaría con el
 * badge "Completado" (de `estadoDeCurso`) al lado de una barra en 40%: la
 * misma regla de negocio contada dos veces con resultados distintos, porque
 * `estadoDeCurso` la aplica al ESTADO y nada la aplicaba al NÚMERO. Se
 * exporta aparte de `estadoDeCurso` en vez de devolver los dos juntos porque
 * los llamadores ya tienen el `porcentajeLecciones` calculado por su cuenta
 * (para otras cosas: "3 de 10 clases", ordenar por avance) y no todos
 * necesitan el número ajustado — solo el que se muestra en una barra.
 */
export function porcentajeMostrado(
  porcentajeLecciones: number,
  examen: EstadoExamenCurso | undefined,
): number {
  return examen?.requerido && examen.aprobado ? 100 : porcentajeLecciones;
}
