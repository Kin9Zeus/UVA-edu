import type { SupabaseClient } from "@supabase/supabase-js";
import { tieneAccesoVigente } from "@/lib/mux/acceso";
import type { SuscripcionActual } from "@/lib/suscripcion";

export type AccesoCurso = {
  /** Cortesía al curso, suscripción vigente, o ser instructor del curso — ver `tieneAccesoVigente` y el comentario de más abajo sobre `esInstructorDelCurso`. */
  tieneAcceso: boolean;
  tieneCortesia: boolean;
  /** null si nunca hubo suscripción. Se expone aparte porque `tieneAcceso` sola no distingue "nunca canjeó" de "canjeó y se le venció" — el CTA del curso (curso.ts) sí necesita esa distinción. */
  suscripcion: Pick<SuscripcionActual, "estado" | "fechaRenovacion"> | null;
};

const SIN_ACCESO: AccesoCurso = { tieneAcceso: false, tieneCortesia: false, suscripcion: null };

/**
 * Única función que decide si un usuario puede ver el CONTENIDO de un curso
 * (temario con candado aparte, ver policy `cursos_select_publicos`): cortesía
 * activa a ese curso puntual, o suscripción vigente por estado y fecha.
 *
 * Antes esta consulta (inscripciones CORTESIA + última suscripción) y el OR
 * que las combina estaban escritos tres veces por separado — en
 * `src/lib/curso.ts`, en una función privada `tieneAccesoAlCurso` de
 * `src/lib/leccion.ts`, y en `src/lib/video/reproduccion.ts` — sincronizadas
 * solo porque nadie las había tocado todavía. Es exactamente el riesgo que
 * describe el ticket del muro de acceso: la regla real vive en
 * `tieneAccesoVigente` (src/lib/mux/acceso.ts, con sus propios tests), y esta
 * función es el único punto que la conecta con Supabase — los tres llamadores
 * ahora piden aquí en vez de repetir las consultas.
 */
export async function obtenerAccesoAlCurso(
  supabase: SupabaseClient,
  usuarioId: string | null,
  cursoId: string,
): Promise<AccesoCurso> {
  if (!usuarioId) return SIN_ACCESO;

  // Solo CORTESIA activa: una MEMBRESIA no sobrevive a la suscripción que la
  // originó (ver mux/acceso.ts), y una CORTESIA revocada tampoco cuenta — la
  // fila se conserva marcada `activo = false`, no se borra (f4accesos.md).
  const [{ data: inscripcion }, { data: suscripcionRaw }, { data: filaInstructor }] = await Promise.all([
    supabase
      .from("inscripciones")
      .select("id")
      .eq("id_usuario", usuarioId)
      .eq("id_curso", cursoId)
      .eq("tipo_acceso", "CORTESIA")
      .eq("activo", true)
      .maybeSingle(),
    // Última suscripción sin filtrar por estado a propósito: la vigencia la
    // decide `tieneAccesoVigente`, que además del estado mira la fecha.
    // Filtrar aquí escondería justo el caso que hay que detectar — una
    // ACTIVA con el periodo ya terminado.
    supabase
      .from("suscripciones")
      .select("estado, fecha_renovacion")
      .eq("id_usuario", usuarioId)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Un profesor entra gratis SOLO a los cursos que él mismo dicta (fila
    // propia en `curso_instructores`) — decisión de producto todavía en
    // discusión para extenderla a "todo el catálogo", así que por ahora es
    // deliberadamente puntual por curso, no un bypass por rol PROFESOR.
    // `curso_instructores_publico` (no la tabla base) porque ya trae el
    // mismo criterio de acceso que el resto de esta función usa para
    // exponer datos públicos, sin duplicar el WHERE.
    supabase
      .from("curso_instructores_publico")
      .select("id_instructor")
      .eq("id_curso", cursoId)
      .eq("id_instructor", usuarioId)
      .maybeSingle(),
  ]);

  const suscripcion = suscripcionRaw
    ? { estado: suscripcionRaw.estado, fechaRenovacion: suscripcionRaw.fecha_renovacion }
    : null;
  const tieneCortesia = inscripcion !== null;
  const esInstructorDelCurso = filaInstructor !== null;

  return {
    tieneAcceso: tieneAccesoVigente(suscripcion, tieneCortesia) || esInstructorDelCurso,
    tieneCortesia,
    suscripcion,
  };
}
