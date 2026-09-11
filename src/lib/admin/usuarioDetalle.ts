import { createClient } from "@/lib/supabase/server";
import { estadoSuscripcionEfectivo, tipoAccesoGratuito, type TipoAccesoGratuito } from "@/lib/estadoAcceso";
import {
  estadoDeCurso,
  getEstadoExamenPorCurso,
  type EstadoCursoConExamen,
} from "@/lib/examenes/estadoPorCurso";
import { esUuid } from "@/lib/slug";

export type CursoDelUsuario = {
  /**
   * `null` cuando el curso no tiene fila en `inscripciones` — un estudiante
   * con membresía activa tiene acceso a todos los cursos sin que se le cree
   * una por cada uno (ver obtenerAccesoAlCurso, src/lib/accesoCurso.ts), así que el
   * único rastro de que empezó ESTE curso es su progreso.
   */
  inscripcionId: string | null;
  cursoId: string;
  /** Para enlazar la ficha del panel (/admin/cursos/<slug>). `null` si el
   * curso ya no existe: el enlace cae al UUID y la página da 404. */
  cursoSlug: string | null;
  titulo: string;
  progreso: number;
  /** EXAMEN_PENDIENTE: terminó todas las clases pero el curso exige examen
   * final y todavía no lo aprobó, así que no tiene certificado (Revf5). */
  estado: EstadoCursoConExamen;
  tipoAcceso: "MEMBRESIA" | "CORTESIA";
  /** Solo relevante para CORTESIA: false si el admin la revocó (f4accesos.md). MEMBRESIA siempre viene en true — no tiene este concepto. */
  activo: boolean;
  /** Motivo que el admin escribió al revocar. null si sigue activa o si es MEMBRESIA (ese concepto no existe ahí). */
  motivoRevocacion: string | null;
  ultimaActividad: string | null;
};

export type UsuarioDetalle = {
  id: string;
  nombre: string;
  correo: string;
  rol: "ESTUDIANTE" | "ADMINISTRADOR" | "PROFESOR";
  /**
   * Solo tiene sentido con rol PROFESOR. Es el dato que antes vivía en
   * `instructores.especialidad` y que sale, junto al nombre, en la tarjeta de
   * "quién dicta el curso" del detalle público — el único campo de esta ficha
   * visible para alguien sin sesión (vía `curso_instructores_publico`).
   */
  especialidad: string | null;
  estado: "ACTIVO" | "SUSPENDIDO";
  fechaRegistro: string;
  suscripcionEstado: "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA" | null;
  /** null = nunca tuvo ninguna. Se necesita para poder revocarla (revocarMembresia). */
  suscripcionId: string | null;
  /** true si esta suscripción la otorgó un admin a mano (o vía código de invitación), no Stripe/Wompi. Revocar (f4accesos.md) solo aplica a estas. */
  suscripcionEsManual: boolean;
  planActual: string | null;
  /** null = sin suscripción o de pago (Stripe/Wompi). Misma clasificación que ve el estudiante, ver src/lib/estadoAcceso.ts. */
  tipoAccesoSuscripcion: TipoAccesoGratuito | null;
  /** Cuándo empezó y cuándo se vence/renueva la suscripción actual. null si nunca tuvo una. */
  suscripcionInicio: string | null;
  suscripcionFin: string | null;
  /** Motivo que el admin escribió al revocar (`revocarMembresia`). null si nunca se canceló a mano. */
  suscripcionMotivoCancelacion: string | null;
  cursos: CursoDelUsuario[];
  metricas: {
    cursosInscritos: number;
    cursosCompletados: number;
    progresoPromedio: number;
    ultimaActividad: string | null;
  };
};

/**
 * Id y slug del usuario a partir de lo que llegue en la URL del panel: el slug
 * (lo normal) o el UUID (bitácora, enlaces viejos). Mismo criterio que
 * resolverCursoAdmin (lib/admin/cursoDetalle.ts).
 */
export async function resolverUsuarioAdmin(
  identificador: string,
): Promise<{ id: string; slug: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfiles")
    .select("id, slug")
    .eq(esUuid(identificador) ? "id" : "slug", identificador)
    .maybeSingle();
  return data as { id: string; slug: string } | null;
}

export async function getUsuarioDetalle(usuarioId: string): Promise<UsuarioDetalle | null> {
  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, especialidad, estado, fecha_registro:creado_en")
    .eq("id", usuarioId)
    .single();

  if (!perfil) return null;

  const { data: suscripciones } = await supabase
    .from("suscripciones")
    .select(
      "id, estado, fecha_inicio, fecha_renovacion, acceso_manual, id_codigo_invitacion, motivo_cancelacion, plan:planes(nombre)",
    )
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

  // Un acceso por código/cortesía (sin plan) no tiene un nombre que decir la
  // duración por sí solo — "Acceso por invitación" a secas no distingue un
  // código de 15 días de uno de 90. Se deriva de las fechas reales, mismo
  // cálculo que ya hacía el lado del estudiante (src/lib/suscripcion.ts).
  const duracionDiasManual =
    !plan && suscripcion?.fecha_renovacion
      ? Math.max(
          1,
          Math.round(
            (new Date(suscripcion.fecha_renovacion).getTime() -
              new Date(suscripcion.fecha_inicio).getTime()) /
              86_400_000,
          ),
        )
      : null;

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("id, id_curso, tipo_acceso, activo, motivo_revocacion, curso:cursos(titulo, slug)")
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
      cursoSlug: curso?.slug ?? null,
      titulo: curso?.titulo ?? "Curso eliminado",
      progreso: porcentaje,
      // Provisional: el examen se resuelve más abajo, de una sola vez para
      // todos los cursos de la lista (ver el bloque "Revf5").
      estado: porcentaje >= 100 ? "COMPLETADO" : "EN_PROGRESO",
      tipoAcceso: inscripcion.tipo_acceso,
      activo: inscripcion.activo,
      motivoRevocacion: inscripcion.motivo_revocacion,
      ultimaActividad,
    });
  }

  // Cursos que el estudiante empezó por MEMBRESÍA sin una fila en
  // `inscripciones` (el acceso por suscripción se valida en caliente contra
  // `suscripciones`, no se materializa una inscripción por curso — ver
  // obtenerAccesoAlCurso en src/lib/accesoCurso.ts). Sin este bloque, un curso que el
  // usuario ya venía viendo en "Sigue aprendiendo" del dashboard no
  // aparecía aquí: la ficha de admin solo mostraba las cortesías.
  const cursoIdsConInscripcion = new Set(cursos.map((curso) => curso.cursoId));

  const { data: progresoUsuario } = await supabase
    .from("progreso")
    .select(
      "completado, actualizado_en, leccion:lecciones!inner(modulo:modulos!inner(id_curso, curso:cursos(titulo, slug)))",
    )
    .eq("id_usuario", usuarioId);

  const progresoPorCursoSinInscripcion = new Map<
    string,
    {
      titulo: string;
      slug: string | null;
      total: number;
      completados: number;
      ultimaActividad: string | null;
    }
  >();
  for (const fila of progresoUsuario ?? []) {
    const leccion = Array.isArray(fila.leccion) ? fila.leccion[0] : fila.leccion;
    const modulo = leccion ? (Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo) : null;
    const cursoId = modulo?.id_curso as string | undefined;
    if (!cursoId || cursoIdsConInscripcion.has(cursoId)) continue;

    const cursoEmbebido = modulo?.curso;
    const cursoInfo = Array.isArray(cursoEmbebido) ? cursoEmbebido[0] : cursoEmbebido;

    const actual = progresoPorCursoSinInscripcion.get(cursoId) ?? {
      titulo: cursoInfo?.titulo ?? "Curso eliminado",
      slug: cursoInfo?.slug ?? null,
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
      cursoSlug: datos.slug,
      titulo: datos.titulo,
      progreso: porcentaje,
      estado: porcentaje >= 100 ? "COMPLETADO" : "EN_PROGRESO",
      tipoAcceso: "MEMBRESIA",
      activo: true,
      motivoRevocacion: null,
      ultimaActividad: datos.ultimaActividad,
    });
  }

  // Revf5: un curso al 100% de clases cuyo examen final no está aprobado NO
  // está completo — no tiene certificado. Se resuelve acá, con la lista de
  // cursos ya armada, para que sean dos consultas en total y no dos por curso.
  const estadoExamenes = await getEstadoExamenPorCurso(
    supabase,
    cursos.map((curso) => curso.cursoId),
    usuarioId,
  );
  for (const curso of cursos) {
    curso.estado = estadoDeCurso(curso.progreso, estadoExamenes.get(curso.cursoId));
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
    especialidad: perfil.especialidad ?? null,
    estado: perfil.estado,
    fechaRegistro: perfil.fecha_registro,
    // Estado EFECTIVO, no el crudo de la fila (mismo motivo que
    // admin_listar_usuarios, ver 040_admin_listado_usa_vigencia_real.sql):
    // una ACTIVA/PAST_DUE cuya fecha ya pasó se reporta VENCIDA aunque nada
    // en `suscripciones` la haya actualizado todavía.
    suscripcionEstado: suscripcion
      ? estadoSuscripcionEfectivo({ estado: suscripcion.estado, fechaRenovacion: suscripcion.fecha_renovacion })
      : null,
    suscripcionId: suscripcion?.id ?? null,
    suscripcionEsManual: suscripcion?.acceso_manual ?? false,
    // Sin plan pero con suscripción = acceso por código de invitación
    // (`id_plan` NULL, ver 035_canje_codigo_por_dias.sql). Distinto de no
    // tener suscripción, que sí es null. Con los días reales al lado: antes
    // decía "Acceso por invitación" a secas, sin distinguir un código de 15
    // días de uno de 90 — justo lo que el admin necesita ver de un vistazo.
    planActual: plan?.nombre
      ? plan.nombre
      : suscripcion
        ? duracionDiasManual
          ? `Acceso por invitación · ${duracionDiasManual} día${duracionDiasManual === 1 ? "" : "s"}`
          : "Acceso por invitación"
        : null,
    tipoAccesoSuscripcion,
    suscripcionInicio: suscripcion?.fecha_inicio ?? null,
    suscripcionFin: suscripcion?.fecha_renovacion ?? null,
    suscripcionMotivoCancelacion: suscripcion?.motivo_cancelacion ?? null,
    cursos,
    metricas: {
      cursosInscritos: cursos.length,
      cursosCompletados: cursos.filter((curso) => curso.estado === "COMPLETADO").length,
      progresoPromedio,
      ultimaActividad: ultimaActividadGlobal,
    },
  };
}
