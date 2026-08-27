import { createClient } from "@/lib/supabase/server";
import { tipoAccesoGratuito, type TipoAccesoGratuito } from "@/lib/estadoAcceso";

export type CursoDelUsuario = {
  /**
   * `null` cuando el curso no tiene fila en `inscripciones` — un estudiante
   * con membresía activa tiene acceso a todos los cursos sin que se le cree
   * una por cada uno (ver tieneAccesoAlCurso, lib/leccion.ts), así que el
   * único rastro de que empezó ESTE curso es su progreso.
   */
  inscripcionId: string | null;
  cursoId: string;
  titulo: string;
  progreso: number;
  estado: "EN_PROGRESO" | "COMPLETADO";
  tipoAcceso: "MEMBRESIA" | "CORTESIA";
  ultimaActividad: string | null;
};

export type UsuarioDetalle = {
  id: string;
  nombre: string;
  correo: string;
  rol: "ESTUDIANTE" | "ADMINISTRADOR";
  estado: "ACTIVO" | "SUSPENDIDO";
  fechaRegistro: string;
  suscripcionEstado: "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA" | null;
  planActual: string | null;
  /** null = sin suscripción o de pago (Stripe/Wompi). Misma clasificación que ve el estudiante, ver src/lib/estadoAcceso.ts. */
  tipoAccesoSuscripcion: TipoAccesoGratuito | null;
  cursos: CursoDelUsuario[];
  metricas: {
    cursosInscritos: number;
    cursosCompletados: number;
    progresoPromedio: number;
    ultimaActividad: string | null;
  };
};

export async function getUsuarioDetalle(usuarioId: string): Promise<UsuarioDetalle | null> {
  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, estado, fecha_registro:creado_en")
    .eq("id", usuarioId)
    .single();

  if (!perfil) return null;

  const { data: suscripciones } = await supabase
    .from("suscripciones")
    .select("estado, fecha_inicio, acceso_manual, id_codigo_invitacion, plan:planes(nombre)")
    .eq("id_usuario", usuarioId)
    .order("fecha_inicio", { ascending: false })
    .limit(1);

  const suscripcion = suscripciones?.[0];
  const plan = suscripcion ? (Array.isArray(suscripcion.plan) ? suscripcion.plan[0] : suscripcion.plan) : null;
  const tipoAccesoSuscripcion = suscripcion
    ? tipoAccesoGratuito({
        accesoManual: suscripcion.acceso_manual,
        tieneCodigoInvitacion: suscripcion.id_codigo_invitacion !== null,
      })
    : null;

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("id, id_curso, tipo_acceso, curso:cursos(titulo)")
    .eq("id_usuario", usuarioId);

  const cursos: CursoDelUsuario[] = [];
  for (const inscripcion of inscripciones ?? []) {
    const curso = Array.isArray(inscripcion.curso) ? inscripcion.curso[0] : inscripcion.curso;

    // El total es TODAS las lecciones del curso, no cuántas de ellas tienen
    // fila en `progreso` (mismo bug que tenía lib/admin/cursoDetalle.ts):
    // alguien que solo abrió/completó 3 de 4 clases y nunca tocó la cuarta
    // salía en 100% ("Completado") en vez de 75%.
    const { count: totalLecciones } = await supabase
      .from("lecciones")
      .select("id, modulo:modulos!inner(id_curso)", { count: "exact", head: true })
      .eq("modulo.id_curso", inscripcion.id_curso);

    const { data: progreso } = await supabase
      .from("progreso")
      .select("completado, fecha_actualizacion:actualizado_en, leccion:lecciones!inner(modulo:modulos!inner(id_curso))")
      .eq("id_usuario", usuarioId)
      .eq("leccion.modulo.id_curso", inscripcion.id_curso);

    const total = totalLecciones ?? 0;
    const completados = progreso?.filter((registro) => registro.completado).length ?? 0;
    const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;
    const ultimaActividad = (progreso ?? []).reduce<string | null>((max, registro) => {
      if (!registro.fecha_actualizacion) return max;
      if (!max || new Date(registro.fecha_actualizacion) > new Date(max)) return registro.fecha_actualizacion;
      return max;
    }, null);

    cursos.push({
      inscripcionId: inscripcion.id,
      cursoId: inscripcion.id_curso,
      titulo: curso?.titulo ?? "Curso eliminado",
      progreso: porcentaje,
      estado: porcentaje >= 100 ? "COMPLETADO" : "EN_PROGRESO",
      tipoAcceso: inscripcion.tipo_acceso,
      ultimaActividad,
    });
  }

  // Cursos que el estudiante empezó por MEMBRESÍA sin una fila en
  // `inscripciones` (el acceso por suscripción se valida en caliente contra
  // `suscripciones`, no se materializa una inscripción por curso — ver
  // tieneAccesoAlCurso en lib/leccion.ts). Sin este bloque, un curso que el
  // usuario ya venía viendo en "Sigue aprendiendo" del dashboard no
  // aparecía aquí: la ficha de admin solo mostraba las cortesías.
  const cursoIdsConInscripcion = new Set(cursos.map((curso) => curso.cursoId));

  const { data: progresoUsuario } = await supabase
    .from("progreso")
    .select(
      "completado, actualizado_en, leccion:lecciones!inner(modulo:modulos!inner(id_curso, curso:cursos(titulo)))",
    )
    .eq("id_usuario", usuarioId);

  const progresoPorCursoSinInscripcion = new Map<
    string,
    { titulo: string; total: number; completados: number; ultimaActividad: string | null }
  >();
  for (const fila of progresoUsuario ?? []) {
    const leccion = Array.isArray(fila.leccion) ? fila.leccion[0] : fila.leccion;
    const modulo = leccion ? (Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo) : null;
    const cursoId = modulo?.id_curso as string | undefined;
    if (!cursoId || cursoIdsConInscripcion.has(cursoId)) continue;

    const cursoEmbebido = modulo?.curso;
    const cursoTitulo = (Array.isArray(cursoEmbebido) ? cursoEmbebido[0] : cursoEmbebido)?.titulo;

    const actual = progresoPorCursoSinInscripcion.get(cursoId) ?? {
      titulo: cursoTitulo ?? "Curso eliminado",
      total: 0,
      completados: 0,
      ultimaActividad: null,
    };
    actual.total += 1;
    if (fila.completado) actual.completados += 1;
    if (fila.actualizado_en && (!actual.ultimaActividad || fila.actualizado_en > actual.ultimaActividad)) {
      actual.ultimaActividad = fila.actualizado_en;
    }
    progresoPorCursoSinInscripcion.set(cursoId, actual);
  }

  for (const [cursoId, datos] of progresoPorCursoSinInscripcion) {
    // El total real de lecciones del curso, no cuántas tocó (mismo criterio
    // que arriba): puede haber avanzado en 3 de 10 y esas 3 son las únicas
    // con fila en `progreso`.
    const { count: totalLecciones } = await supabase
      .from("lecciones")
      .select("id, modulo:modulos!inner(id_curso)", { count: "exact", head: true })
      .eq("modulo.id_curso", cursoId);

    const total = totalLecciones ?? 0;
    const porcentaje = total > 0 ? Math.round((datos.completados / total) * 100) : 0;

    cursos.push({
      inscripcionId: null,
      cursoId,
      titulo: datos.titulo,
      progreso: porcentaje,
      estado: porcentaje >= 100 ? "COMPLETADO" : "EN_PROGRESO",
      tipoAcceso: "MEMBRESIA",
      ultimaActividad: datos.ultimaActividad,
    });
  }

  const progresoPromedio =
    cursos.length > 0 ? Math.round(cursos.reduce((sum, curso) => sum + curso.progreso, 0) / cursos.length) : 0;
  const ultimaActividadGlobal = cursos.reduce<string | null>((max, curso) => {
    if (!curso.ultimaActividad) return max;
    if (!max || new Date(curso.ultimaActividad) > new Date(max)) return curso.ultimaActividad;
    return max;
  }, null);

  return {
    id: perfil.id,
    nombre: perfil.nombre,
    correo: perfil.correo,
    rol: perfil.rol,
    estado: perfil.estado,
    fechaRegistro: perfil.fecha_registro,
    suscripcionEstado: suscripcion?.estado ?? null,
    // Sin plan pero con suscripción = acceso por código de invitación
    // (`id_plan` NULL, ver 035_canje_codigo_por_dias.sql). Distinto de no
    // tener suscripción, que sí es null.
    planActual: plan?.nombre ?? (suscripcion ? "Acceso por invitación" : null),
    tipoAccesoSuscripcion,
    cursos,
    metricas: {
      cursosInscritos: cursos.length,
      cursosCompletados: cursos.filter((curso) => curso.estado === "COMPLETADO").length,
      progresoPromedio,
      ultimaActividad: ultimaActividadGlobal,
    },
  };
}
