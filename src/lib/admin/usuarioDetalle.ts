import { createClient } from "@/lib/supabase/server";
import { estadoSuscripcionEfectivo, tipoAccesoGratuito, type TipoAccesoGratuito } from "@/lib/estadoAcceso";
import {
  estadoDeCurso,
  getEstadoExamenPorCurso,
  porcentajeLecciones,
  porcentajeMostrado,
  type EstadoCursoConExamen,
} from "@/lib/examenes/estadoPorCurso";
import { esUuid } from "@/lib/slug";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { semanasRecientes } from "@/lib/admin/semanas";
import { origenDe, type AccesoListado } from "@/lib/admin/usuarios";
import {
  construirHistorial,
  resumirDiasEstudio,
  totalPagado,
  type AccesoDeLaFicha,
  type EstudioDeLaPersona,
  type EventoHistorial,
  type PagoDeLaFicha,
} from "@/lib/admin/usuario-historial";

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
  fotoUrl: string | null;
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
  /** El acceso actual, con la misma forma que la lista para decirlo igual. */
  acceso: AccesoListado | null;
  /** La misma suscripción, con lo que hace falta para revocarla o darle más días. */
  accesoActual: AccesoDeLaFicha | null;
  historial: EventoHistorial[];
  /** null si nunca pagó. */
  totalPagado: string | null;
  estudio: EstudioDeLaPersona;
  clasesTerminadas: number;
  /** Cursos donde figura como profesor: quitarle el rol no lo saca de ellos. */
  cursosQueDicta: { titulo: string; slug: string }[];
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
  const { data, error: errorData } = await supabase
    .from("perfiles")
    .select("id, slug")
    .eq(esUuid(identificador) ? "id" : "slug", identificador)
    .maybeSingle();
  lanzarSiFalla(errorData, "usuarioDetalle:perfiles");
  return data as { id: string; slug: string } | null;
}

/**
 * Solo las clases con video listo cuentan para el avance: es la regla de lo
 * que ve el estudiante (`progreso_cursos_estudiante`) y del certificado
 * (`private.lecciones_completas_curso`). El embed llega como objeto o arreglo.
 */
function conVideoListo(
  leccion: { estado_procesamiento: string } | { estado_procesamiento: string }[] | null | undefined,
): boolean {
  const fila = Array.isArray(leccion) ? leccion[0] : leccion;
  return fila?.estado_procesamiento === "LISTO";
}

export async function getUsuarioDetalle(usuarioId: string): Promise<UsuarioDetalle | null> {
  const supabase = await createClient();

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, foto_url, rol, especialidad, estado, fecha_registro:creado_en")
    .eq("id", usuarioId)
    .maybeSingle();
  lanzarSiFalla(errorPerfil, "usuarioDetalle:perfiles");

  if (!perfil) return null;

  const ahora = new Date();
  const [
    { data: suscripciones, error: errorSuscripciones },
    { data: intentos, error: errorIntentos },
    { data: actividad, error: errorActividad },
    { data: dicta, error: errorDicta },
  ] = await Promise.all([
    supabase
      .from("suscripciones")
      .select(
        "id, estado, proveedor, fecha_inicio, fecha_renovacion, acceso_manual, id_codigo_invitacion, motivo_cancelacion, actualizado_en, monto_centavos, moneda, plan:planes(nombre), codigo:codigos_invitacion(codigo, id_lote)",
      )
      .eq("id_usuario", usuarioId)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("intentos_pago")
      .select("estado, monto_centavos, moneda, actualizado_en, plan:planes(nombre), cupon:cupones(codigo)")
      .eq("id_usuario", usuarioId),
    supabase
      .from("actividad_diaria")
      .select("fecha")
      .eq("id_usuario", usuarioId)
      .gte("fecha", semanasRecientes(ahora).primerLunes),
    supabase.from("curso_instructores").select("curso:cursos(titulo, slug)").eq("id_instructor", usuarioId),
  ]);
  lanzarSiFalla(errorSuscripciones, "usuarioDetalle:suscripciones");
  lanzarSiFalla(errorIntentos, "usuarioDetalle:intentos_pago");
  lanzarSiFalla(errorActividad, "usuarioDetalle:actividad_diaria");
  lanzarSiFalla(errorDicta, "usuarioDetalle:curso_instructores");

  // La actual es la vigente si la hay (a lo sumo una, por el índice parcial
  // `suscripcion_activa_unica_por_usuario`); si no, la más reciente. Mismo
  // criterio que admin_listar_usuarios, para que lista y ficha digan lo mismo.
  const suscripcion =
    (suscripciones ?? []).find((s) => s.estado === "ACTIVA" || s.estado === "PAST_DUE") ?? suscripciones?.[0];
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

  const { data: inscripciones, error: errorInscripciones } = await supabase
    .from("inscripciones")
    .select("id, id_curso, tipo_acceso, activo, motivo_revocacion, curso:cursos(titulo, slug)")
    .eq("id_usuario", usuarioId);
  lanzarSiFalla(errorInscripciones, "usuarioDetalle:inscripciones");

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
      .eq("modulo.id_curso", inscripcion.id_curso)
      .eq("estado_procesamiento", "LISTO");

    const { data: progreso, error: errorProgreso } = await supabase
      .from("progreso")
      .select(
        "completado, fecha_actualizacion:actualizado_en, leccion:lecciones!inner(estado_procesamiento, modulo:modulos!inner(id_curso))",
      )
      .eq("id_usuario", usuarioId)
      .eq("leccion.modulo.id_curso", inscripcion.id_curso);
    lanzarSiFalla(errorProgreso, "usuarioDetalle:progreso");

    const total = totalLecciones ?? 0;
    const completados =
      progreso?.filter((registro) => registro.completado && conVideoListo(registro.leccion)).length ?? 0;
    const porcentaje = porcentajeLecciones(completados, total);
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

  const { data: progresoUsuario, error: errorProgresoUsuario } = await supabase
    .from("progreso")
    .select(
      "completado, actualizado_en, leccion:lecciones!inner(estado_procesamiento, modulo:modulos!inner(id_curso, curso:cursos(titulo, slug)))",
    )
    .eq("id_usuario", usuarioId);
  lanzarSiFalla(errorProgresoUsuario, "usuarioDetalle:progreso");

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
    if (fila.completado && conVideoListo(leccion)) actual.completados += 1;
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
      .eq("modulo.id_curso", cursoId)
      .eq("estado_procesamiento", "LISTO");

    const total = totalLecciones ?? 0;
    const porcentaje = porcentajeLecciones(datos.completados, total);

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
    const examen = estadoExamenes.get(curso.cursoId);
    curso.estado = estadoDeCurso(curso.progreso, examen);
    // `curso.progreso` traía el crudo de lecciones (provisional, calculado
    // antes de conocer el examen — ver los dos bloques de arriba); ahora que
    // ya se resolvió el examen se ajusta igual que `estado`, para que la
    // barra nunca diga menos de 100% al lado de un badge "Completado".
    curso.progreso = porcentajeMostrado(curso.progreso, examen);
  }

  const uno = <T,>(valor: T | T[] | null | undefined): T | null => (Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null));
  const accesos: AccesoDeLaFicha[] = (suscripciones ?? []).map((s) => {
    const codigo = uno(s.codigo as { codigo: string; id_lote: string | null } | { codigo: string; id_lote: string | null }[] | null);
    return {
      id: s.id,
      estado: estadoSuscripcionEfectivo({ estado: s.estado, fechaRenovacion: s.fecha_renovacion }, ahora),
      proveedor: s.proveedor,
      inicio: s.fecha_inicio,
      fin: s.fecha_renovacion,
      plan: uno(s.plan as { nombre: string } | { nombre: string }[] | null)?.nombre ?? null,
      codigo: codigo?.codigo ?? null,
      deLote: Boolean(codigo?.id_lote),
      motivoCancelacion: s.motivo_cancelacion,
      actualizadoEn: s.actualizado_en,
    };
  });
  const pagos: PagoDeLaFicha[] = (intentos ?? []).map((p) => ({
    estado: p.estado as PagoDeLaFicha["estado"],
    montoCentavos: Number(p.monto_centavos),
    moneda: p.moneda,
    plan: uno(p.plan as { nombre: string } | { nombre: string }[] | null)?.nombre ?? "",
    cupon: uno(p.cupon as { codigo: string } | { codigo: string }[] | null)?.codigo ?? null,
    fecha: p.actualizado_en,
  }));
  const actualDeLaFicha = suscripcion ? accesos.find((a) => a.id === suscripcion.id) ?? null : null;

  const clasesTerminadas = (progresoUsuario ?? []).filter((fila) => {
    const leccion = Array.isArray(fila.leccion) ? fila.leccion[0] : fila.leccion;
    return fila.completado && leccion?.estado_procesamiento === "LISTO";
  }).length;

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
    fotoUrl: perfil.foto_url,
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
    acceso: actualDeLaFicha
      ? {
          estado: actualDeLaFicha.estado,
          origen: origenDe(actualDeLaFicha.proveedor),
          inicio: actualDeLaFicha.inicio,
          fin: actualDeLaFicha.fin,
          plan: actualDeLaFicha.plan,
          montoCentavos: suscripcion ? Number(suscripcion.monto_centavos) : null,
          moneda: suscripcion?.moneda ?? null,
          proveedor: actualDeLaFicha.proveedor,
        }
      : null,
    accesoActual: actualDeLaFicha,
    historial: construirHistorial(accesos, pagos, ahora),
    totalPagado: totalPagado(pagos),
    estudio: resumirDiasEstudio((actividad ?? []).map((fila) => fila.fecha as string), ahora),
    clasesTerminadas,
    cursosQueDicta: (dicta ?? [])
      .map((fila) => uno(fila.curso as { titulo: string; slug: string } | { titulo: string; slug: string }[] | null))
      .filter((curso): curso is { titulo: string; slug: string } => curso !== null),
    cursos,
    metricas: {
      cursosInscritos: cursos.length,
      cursosCompletados: cursos.filter((curso) => curso.estado === "COMPLETADO").length,
      progresoPromedio,
      ultimaActividad: ultimaActividadGlobal,
    },
  };
}
