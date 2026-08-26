import { createClient } from "@/lib/supabase/server";

export type CursoDelUsuario = {
  inscripcionId: string;
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
    .select("estado, fecha_inicio, plan:planes(nombre)")
    .eq("id_usuario", usuarioId)
    .order("fecha_inicio", { ascending: false })
    .limit(1);

  const suscripcion = suscripciones?.[0];
  const plan = suscripcion ? (Array.isArray(suscripcion.plan) ? suscripcion.plan[0] : suscripcion.plan) : null;

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
    planActual: plan?.nombre ?? null,
    cursos,
    metricas: {
      cursosInscritos: cursos.length,
      cursosCompletados: cursos.filter((curso) => curso.estado === "COMPLETADO").length,
      progresoPromedio,
      ultimaActividad: ultimaActividadGlobal,
    },
  };
}
