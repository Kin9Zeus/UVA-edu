import type { SupabaseClient } from "@supabase/supabase-js";
import { tieneAccesoVigente } from "@/lib/mux/acceso";
import type { SuscripcionActual } from "@/lib/suscripcion";
import { lanzarSiFalla } from "@/lib/supabase/errores";

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
 *
 * Un ADMINISTRADOR tiene acceso incondicional a todo el catálogo, sin
 * suscripción propia ni cortesía por curso — misma noción que ya usa RLS
 * (`private.es_administrador()`, ver 030_acceso_curso_despublicado.sql y
 * 038_vigencia_por_fecha.sql en TODAS las policies de cursos/modulos/lecciones/
 * recursos_descargables). Antes esta función no lo miraba, así que un admin
 * sin suscripción propia veía el temario con candado y el reproductor de
 * lección le devolvía 404 fuera del modo Vista Previa — RLS ya lo dejaba
 * entrar, pero esta capa se lo negaba antes de llegar a esa consulta.
 *
 * LANZA si alguna de sus consultas falla (AUDIT-2026-09-22.md, seguimiento
 * de P2-3). Antes un fallo llegaba como `data: null` y se leía como "sin
 * cortesía, sin suscripción": a un estudiante que sí paga, la ficha le
 * mostraba el candado y "Canjea tu código", la lección lo devolvía a la
 * ficha y el reproductor cortaba el video con "No tienes acceso vigente".
 * Lanzar sigue sin mostrar contenido —el muro no se abre por un fallo—, pero
 * ahora dice la verdad: la página responde 500 con "Reintentar", y el
 * reproductor, que ya trata una excepción al renovar el token como falla
 * transitoria, conserva el token anterior y reintenta en segundos
 * (VideoPlayer.tsx, `cargarToken`).
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
  const [
    { data: perfil, error: errorPerfil },
    { data: inscripcion, error: errorInscripcion },
    { data: suscripcionRaw, error: errorSuscripcion },
    { data: filaInstructor, error: errorInstructor },
  ] = await Promise.all([
    // `maybeSingle` y no `single`: con `single`, un perfil que no existe
    // también llega como error (PGRST116) y lanzaría. Sin perfil no hay rol
    // ADMINISTRADOR, que es lo único que se mira de esta fila.
    supabase.from("perfiles").select("rol").eq("id", usuarioId).maybeSingle(),
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
  lanzarSiFalla(errorPerfil, "obtenerAccesoAlCurso:perfiles");
  lanzarSiFalla(errorInscripcion, "obtenerAccesoAlCurso:inscripciones");
  lanzarSiFalla(errorSuscripcion, "obtenerAccesoAlCurso:suscripciones");
  lanzarSiFalla(errorInstructor, "obtenerAccesoAlCurso:curso_instructores_publico");

  const suscripcion = suscripcionRaw
    ? { estado: suscripcionRaw.estado, fechaRenovacion: suscripcionRaw.fecha_renovacion }
    : null;
  const tieneCortesia = inscripcion !== null;
  const esInstructorDelCurso = filaInstructor !== null;
  const esAdministrador = perfil?.rol === "ADMINISTRADOR";

  return {
    tieneAcceso: esAdministrador || tieneAccesoVigente(suscripcion, tieneCortesia) || esInstructorDelCurso,
    tieneCortesia,
    suscripcion,
  };
}
