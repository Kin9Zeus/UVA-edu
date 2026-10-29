import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { getMetricasPanel } from "@/lib/admin/metricas";
import { contarUsuarios } from "@/lib/admin/usuarios";
import { diaEnColombia, sumarDias } from "@/lib/admin/bitacora";
import { diasEntre } from "@/lib/admin/comunidadReportes";
import { DIAS_AVISO_CODIGOS } from "@/lib/admin/codigos-uso";
import { lunesDe, semanasRecientes } from "@/lib/admin/semanas";
import { faltasParaPublicar } from "@/lib/admin/publicacion";
import { getPlanesAdmin } from "@/lib/admin/planes";
import { getVentasPlanes, type SemanaVentas } from "@/lib/admin/planes-ventas";
import { getDeInvitacionAPago } from "@/lib/admin/usuarios-estudio";
import { DIAS_ESTUDIO_CURSOS, DIAS_SIN_AVANZAR } from "@/lib/admin/avance";
import { calcularDisponibilidad } from "@/lib/examen";
import { COOLDOWN_AGOTADO_HORAS } from "@/lib/examenes/tipos";
import { PRECIOS_HABILITADOS } from "@/lib/features";

/** Una semana de la gráfica del Inicio: cada serie que se puede elegir. */
export type SemanaInicio = {
  /** Lunes, "YYYY-MM-DD" en hora de Colombia. */
  inicio: string;
  estudiaron: number;
  /** De las que estudiaron, cuántas lo hacían por primera vez. */
  nuevas: number;
  registros: number;
  canjes: number;
  certificados: number;
};

export type Pendiente = {
  clave: string;
  tono: "warning" | "error" | "success" | "neutral";
  /** null si no es una cantidad (un curso listo para publicar). */
  cantidad: number | null;
  titulo: string;
  detalle: string;
  href: string;
};

export type PasoEmbudo = { etiqueta: string; personas: number };

export type EventoInicio = {
  id: string;
  tipo: "registro" | "canje" | "certificado" | "comunidad";
  nombre: string;
  /** Slug del perfil; null si la persona ya no existe. */
  slug: string | null;
  /** Lo que sigue al nombre: "se registró". */
  texto: string;
  /** El código canjeado, que va en otra letra. */
  codigo?: string;
  fecha: string;
};

export type PagosInicio = {
  semanas: SemanaVentas[];
  recaudadoCop: number;
  ventas30: number;
  intentos30: number;
  vigentes: number;
  vencen: number;
  invitacionTerminada: number;
  pagaronDespues: number;
};

export type DatosInicio = {
  semanas: SemanaInicio[];
  pendientes: Pendiente[];
  embudo: PasoEmbudo[];
  accesoHoy: { total: number; invitacion: number; uva: number; pagan: number };
  cursos30: { id: string; slug: string; titulo: string; personas: number }[];
  actividad: EventoInicio[];
  /** null con el cobro apagado. */
  pagos: PagosInicio | null;
};

const TOPE_CURSOS = 5;
const TOPE_ACTIVIDAD = 8;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Cuenta fechas por semana en las 12 semanas de la gráfica (hora de Colombia). */
export function contarPorSemana(fechas: string[], ahora: Date = new Date()): number[] {
  const { semanas, primerLunes } = semanasRecientes(ahora);
  const indice = new Map(semanas.map((s, i) => [s.inicio, i]));
  const cuentas = semanas.map(() => 0);
  for (const fecha of fechas) {
    const dia = diaEnColombia(fecha);
    if (dia < primerLunes) continue;
    const i = indice.get(lunesDe(dia));
    if (i !== undefined) cuentas[i] += 1;
  }
  return cuentas;
}

/** El paso donde más personas se pierden (índice del paso al que llegan); null si nadie se pierde. */
export function mayorPerdida(pasos: PasoEmbudo[]): number | null {
  let peor: number | null = null;
  for (let i = 1; i < pasos.length; i++) {
    const perdida = pasos[i - 1].personas - pasos[i].personas;
    if (perdida > 0 && (peor === null || perdida > pasos[peor - 1].personas - pasos[peor].personas)) peor = i;
  }
  return peor;
}

type IntentoCerrable = {
  idExamen: string;
  idUsuario: string;
  estado: string;
  finalizadoEn: string | null;
};

/**
 * Por examen, cuántas personas agotaron una tanda de intentos y esperan la
 * espera larga: la misma regla que ve el estudiante (`calcularDisponibilidad`)
 * y que la pestaña Examen llama «necesita otro intento».
 */
export function esperanOtroIntento(
  intentos: IntentoCerrable[],
  intentosMaximos: Map<string, number | null>,
): Map<string, number> {
  const porPersona = new Map<string, IntentoCerrable[]>();
  for (const intento of intentos) {
    const clave = `${intento.idExamen}:${intento.idUsuario}`;
    porPersona.set(clave, [...(porPersona.get(clave) ?? []), intento]);
  }
  const porExamen = new Map<string, number>();
  for (const lista of porPersona.values()) {
    if (lista.some((i) => i.estado === "APROBADO" || i.estado === "EN_CURSO")) continue;
    const idExamen = lista[0].idExamen;
    const cerrados = lista
      .filter((i) => i.finalizadoEn)
      .sort((a, b) => new Date(b.finalizadoEn!).getTime() - new Date(a.finalizadoEn!).getTime());
    const disponibilidad = calcularDisponibilidad(cerrados, intentosMaximos.get(idExamen) ?? null);
    if (!disponibilidad.disponible && disponibilidad.esperaLarga) porExamen.set(idExamen, (porExamen.get(idExamen) ?? 0) + 1);
  }
  return porExamen;
}

type CursoConClases = {
  id: string;
  slug: string;
  titulo: string;
  mostrado: boolean;
  imagen_portada: string | null;
  modulos:
    | {
        titulo: string;
        lecciones: { titulo: string; estado_procesamiento: string }[];
      }[]
    | null;
};

/**
 * Lo que espera algo del admin, en orden de urgencia. Solo entra lo que tiene
 * algo: una lista de ceros no se lee.
 */
export function armarPendientes(d: {
  reportes: { contenidos: number; diasMasAntiguo: number };
  examenes: { slug: string; titulo: string; personas: number }[];
  videosConError: { slug: string; titulo: string; clases: string[] }[];
  pagosPendientes: number;
  planesVencen: number;
  listosParaPublicar: { slug: string; titulo: string }[];
  invitacionesSeAcaban: number;
  parados: number;
}): Pendiente[] {
  const p: Pendiente[] = [];
  if (d.reportes.contenidos > 0) {
    const n = d.reportes.contenidos;
    p.push({
      clave: "reportes",
      tono: "warning",
      cantidad: n,
      titulo: n === 1 ? "1 contenido reportado espera tu decisión" : `${n} contenidos reportados esperan tu decisión`,
      detalle: `En Comunidad. ${n === 1 ? "Es" : "El más antiguo es"} ${d.reportes.diasMasAntiguo === 0 ? "de hoy" : `de hace ${plural(d.reportes.diasMasAntiguo, "día", "días")}`}`,
      href: "/admin/comunidad",
    });
  }
  for (const examen of d.examenes) {
    p.push({
      clave: `examen-${examen.slug}`,
      tono: "warning",
      cantidad: examen.personas,
      titulo: `${plural(examen.personas, "persona agotó", "personas agotaron")} los intentos del examen`,
      detalle: `En ${examen.titulo}. Puedes ${examen.personas === 1 ? "darle" : "darles"} otro intento`,
      href: `/admin/cursos/${examen.slug}?pestana=examen`,
    });
  }
  for (const curso of d.videosConError) {
    const n = curso.clases.length;
    p.push({
      clave: `video-${curso.slug}`,
      tono: "error",
      cantidad: n,
      titulo: n === 1 ? "1 video no se pudo procesar" : `${n} videos no se pudieron procesar`,
      detalle: n === 1 ? `${curso.titulo}, clase «${curso.clases[0]}»` : `En ${curso.titulo}`,
      href: `/admin/cursos/${curso.slug}?pestana=contenido`,
    });
  }
  if (d.pagosPendientes > 0) {
    p.push({
      clave: "pagos",
      tono: "warning",
      cantidad: d.pagosPendientes,
      titulo: d.pagosPendientes === 1 ? "1 pago no se pudo renovar" : `${d.pagosPendientes} pagos no se pudieron renovar`,
      detalle: "En Usuarios. Siguen entrando durante los días de gracia",
      href: "/admin/usuarios?origen=PAGO&suscripcion=PAST_DUE",
    });
  }
  if (d.planesVencen > 0) {
    p.push({
      clave: "planes",
      tono: "neutral",
      cantidad: d.planesVencen,
      titulo: d.planesVencen === 1 ? "1 plan pagado se acaba en 7 días" : `${d.planesVencen} planes pagados se acaban en 7 días`,
      detalle: "En Planes. Para seguir, tienen que volver a comprar",
      href: "/admin/planes",
    });
  }
  for (const curso of d.listosParaPublicar) {
    p.push({
      clave: `publicar-${curso.slug}`,
      tono: "success",
      cantidad: null,
      titulo: `${curso.titulo} ya se puede publicar`,
      detalle: "Tiene portada y todas las clases con video",
      href: `/admin/cursos/${curso.slug}`,
    });
  }
  if (d.invitacionesSeAcaban > 0) {
    const n = d.invitacionesSeAcaban;
    p.push({
      clave: "invitaciones",
      tono: "neutral",
      cantidad: n,
      titulo: `${plural(n, "acceso", "accesos")} por invitación se ${n === 1 ? "acaba" : "acaban"} en ${DIAS_AVISO_CODIGOS} días`,
      detalle: "En Códigos. Desde la ficha de cada persona le puedes dar más días",
      href: "/admin/codigos",
    });
  }
  if (d.parados > 0) {
    p.push({
      clave: "parados",
      tono: "neutral",
      cantidad: d.parados,
      titulo: `${plural(d.parados, "persona", "personas")} con acceso ${d.parados === 1 ? "dejó" : "dejaron"} de estudiar`,
      detalle: `En Usuarios. Llevan ${DIAS_SIN_AVANZAR} días o más sin ver una clase`,
      href: "/admin/usuarios?estudio=PARADOS",
    });
  }
  return p;
}

type Uno<T> = T | T[] | null;
const uno = <T>(valor: Uno<T>): T | null => (Array.isArray(valor) ? (valor[0] ?? null) : valor);

/** Personas que agotaron los intentos, por curso. Solo mira quien cerró un intento en la espera larga. */
async function getEsperanOtroIntento(ahora: Date) {
  const supabase = await createClient();
  const desde = new Date(ahora.getTime() - COOLDOWN_AGOTADO_HORAS * 3_600_000).toISOString();
  const { data: recientes, error } = await supabase.from("intentos_examen").select("id_usuario").gte("finalizado_en", desde);
  lanzarSiFalla(error, "dashboard:intentos_examen");
  const usuarios = [...new Set((recientes ?? []).map((fila) => fila.id_usuario as string))];
  if (usuarios.length === 0) return [];

  const { data: intentos, error: errorIntentos } = await supabase
    .from("intentos_examen")
    .select("id_examen, id_usuario, estado, finalizado_en, examen:examenes(intentos_maximos, curso:cursos(slug, titulo))")
    .in("id_usuario", usuarios);
  lanzarSiFalla(errorIntentos, "dashboard:intentos_examen");

  const maximos = new Map<string, number | null>();
  const cursos = new Map<string, { slug: string; titulo: string }>();
  for (const fila of intentos ?? []) {
    const examen = uno(
      fila.examen as Uno<{
        intentos_maximos: number | null;
        curso: Uno<{ slug: string; titulo: string }>;
      }>,
    );
    maximos.set(fila.id_examen as string, examen?.intentos_maximos ?? null);
    const curso = uno(examen?.curso ?? null);
    if (curso) cursos.set(fila.id_examen as string, curso);
  }
  const porExamen = esperanOtroIntento(
    (intentos ?? []).map((fila) => ({
      idExamen: fila.id_examen as string,
      idUsuario: fila.id_usuario as string,
      estado: fila.estado as string,
      finalizadoEn: (fila.finalizado_en as string | null) ?? null,
    })),
    maximos,
  );
  return [...porExamen.entries()]
    .filter(([idExamen]) => cursos.has(idExamen))
    .map(([idExamen, personas]) => ({ ...cursos.get(idExamen)!, personas }));
}

/** Lo último que hicieron los estudiantes: registros, canjes, certificados y la comunidad. */
async function getActividad(): Promise<EventoInicio[]> {
  const supabase = await createClient();
  const [registros, canjes, certificados, posts, respuestas] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, slug, creado_en")
      .order("creado_en", { ascending: false })
      .limit(TOPE_ACTIVIDAD),
    supabase
      .from("suscripciones")
      .select("id, fecha_inicio, codigo:codigos_invitacion(codigo), usuario:perfiles!suscripciones_id_usuario_fkey(nombre, slug)")
      .not("id_codigo_invitacion", "is", null)
      .order("fecha_inicio", { ascending: false })
      .limit(TOPE_ACTIVIDAD),
    supabase
      .from("certificados")
      .select("id, fecha_emision, nombre_estudiante, nombre_curso, usuario:perfiles(slug)")
      .order("fecha_emision", { ascending: false })
      .limit(TOPE_ACTIVIDAD),
    supabase
      .from("comunidad_posts")
      .select("id, titulo, creado_en, usuario:perfiles(nombre, slug)")
      .eq("eliminado", false)
      .order("creado_en", { ascending: false })
      .limit(TOPE_ACTIVIDAD),
    supabase
      .from("comunidad_respuestas")
      .select("id, creado_en, post:comunidad_posts(titulo), usuario:perfiles(nombre, slug)")
      .eq("eliminado", false)
      .order("creado_en", { ascending: false })
      .limit(TOPE_ACTIVIDAD),
  ]);
  lanzarSiFalla(registros.error, "dashboard:perfiles");
  lanzarSiFalla(canjes.error, "dashboard:canjes");
  lanzarSiFalla(certificados.error, "dashboard:certificados");
  lanzarSiFalla(posts.error, "dashboard:comunidad_posts");
  lanzarSiFalla(respuestas.error, "dashboard:comunidad_respuestas");

  type Persona = { nombre?: string; slug: string };
  const eventos: EventoInicio[] = [
    ...(registros.data ?? []).map((fila) => ({
      id: `registro-${fila.id}`,
      tipo: "registro" as const,
      nombre: fila.nombre as string,
      slug: fila.slug as string,
      texto: "se registró",
      fecha: fila.creado_en as string,
    })),
    ...(canjes.data ?? []).map((fila) => {
      const usuario = uno(fila.usuario as Uno<Persona>);
      return {
        id: `canje-${fila.id}`,
        tipo: "canje" as const,
        nombre: usuario?.nombre ?? "Usuario eliminado",
        slug: usuario?.slug ?? null,
        texto: "entró con el código",
        codigo: uno(fila.codigo as Uno<{ codigo: string }>)?.codigo,
        fecha: fila.fecha_inicio as string,
      };
    }),
    ...(certificados.data ?? []).map((fila) => ({
      id: `certificado-${fila.id}`,
      tipo: "certificado" as const,
      nombre: fila.nombre_estudiante as string,
      slug: uno(fila.usuario as Uno<Persona>)?.slug ?? null,
      texto: `sacó el certificado de ${fila.nombre_curso}`,
      fecha: fila.fecha_emision as string,
    })),
    ...(posts.data ?? []).map((fila) => {
      const usuario = uno(fila.usuario as Uno<Persona>);
      return {
        id: `post-${fila.id}`,
        tipo: "comunidad" as const,
        nombre: usuario?.nombre ?? "Usuario eliminado",
        slug: usuario?.slug ?? null,
        texto: `publicó en la comunidad «${fila.titulo}»`,
        fecha: fila.creado_en as string,
      };
    }),
    ...(respuestas.data ?? []).map((fila) => {
      const usuario = uno(fila.usuario as Uno<Persona>);
      const post = uno(fila.post as Uno<{ titulo: string }>);
      return {
        id: `respuesta-${fila.id}`,
        tipo: "comunidad" as const,
        nombre: usuario?.nombre ?? "Usuario eliminado",
        slug: usuario?.slug ?? null,
        texto: post ? `respondió en la comunidad en «${post.titulo}»` : "respondió en la comunidad",
        fecha: fila.creado_en as string,
      };
    }),
  ];
  return eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, TOPE_ACTIVIDAD);
}

async function getPagos(ahora: Date): Promise<PagosInicio | null> {
  if (!PRECIOS_HABILITADOS) return null;
  const [ventas, invitacion] = await Promise.all([getPlanesAdmin().then(getVentasPlanes), getDeInvitacionAPago(ahora)]);
  return {
    semanas: ventas.semanas,
    recaudadoCop: ventas.recaudadoCop,
    ventas30: ventas.ventas30,
    intentos30: ventas.intentos30,
    vigentes: ventas.vigentes,
    vencen: ventas.vencen,
    ...invitacion,
  };
}

/**
 * Todo el Inicio del panel. Cada cifra sale de la misma fuente que su
 * pantalla: estudio por semana (127, Usuarios), resumen de cursos (129, Cursos),
 * métricas de usuarios (036), ventas de Planes y la regla de espera del examen.
 */
export async function getDashboardData(ahora: Date = new Date()): Promise<DatosInicio> {
  const supabase = await createClient();
  const { primerLunes } = semanasRecientes(ahora);
  const desdeSemanas = `${primerLunes}T00:00:00-05:00`;
  const desde30 = `${sumarDias(diaEnColombia(ahora), -(DIAS_ESTUDIO_CURSOS - 1))}T00:00:00-05:00`;
  const quieto = new Date(ahora.getTime() - DIAS_SIN_AVANZAR * 86_400_000).toISOString();

  const [
    estudio,
    registros,
    canjes,
    certificados,
    resumen,
    cursos,
    reportes,
    invitaciones,
    metricas,
    parados,
    invitacionHoy,
    paganHoy,
    pagoPendiente,
    examenes,
    actividad,
    pagos,
  ] = await Promise.all([
    supabase.rpc("admin_estudio_por_semana", { p_desde: primerLunes }),
    supabase.from("perfiles").select("creado_en").gte("creado_en", desdeSemanas),
    supabase
      .from("suscripciones")
      .select("fecha_inicio")
      .not("id_codigo_invitacion", "is", null)
      .gte("fecha_inicio", desdeSemanas),
    // Todos: el embudo cuenta personas con certificado desde siempre.
    supabase.from("certificados").select("id_usuario, fecha_emision"),
    supabase.rpc("admin_resumen_cursos", {
      p_desde: desde30,
      p_quieto: quieto,
    }),
    supabase
      .from("cursos")
      .select("id, slug, titulo, mostrado, imagen_portada, modulos(titulo, lecciones(titulo, estado_procesamiento))"),
    supabase.from("comunidad_reportes").select("id_post, id_respuesta, creado_en").eq("revisado", false),
    // Igual que «se les acaba» en Códigos: accesos por código vigentes.
    supabase
      .from("suscripciones")
      .select("fecha_renovacion")
      .not("id_codigo_invitacion", "is", null)
      .in("estado", ["ACTIVA", "PAST_DUE"])
      .gt("fecha_renovacion", ahora.toISOString()),
    getMetricasPanel(),
    contarUsuarios({ estudio: "PARADOS" }),
    contarUsuarios({ origen: "INVITACION", suscripcion: "ACTIVA" }),
    contarUsuarios({ origen: "PAGO", suscripcion: "ACTIVA" }),
    contarUsuarios({ origen: "PAGO", suscripcion: "PAST_DUE" }),
    getEsperanOtroIntento(ahora),
    getActividad(),
    getPagos(ahora),
  ]);
  lanzarSiFalla(estudio.error, "dashboard:admin_estudio_por_semana");
  lanzarSiFalla(registros.error, "dashboard:perfiles");
  lanzarSiFalla(canjes.error, "dashboard:suscripciones");
  lanzarSiFalla(certificados.error, "dashboard:certificados");
  lanzarSiFalla(resumen.error, "dashboard:admin_resumen_cursos");
  lanzarSiFalla(cursos.error, "dashboard:cursos");
  lanzarSiFalla(reportes.error, "dashboard:comunidad_reportes");
  lanzarSiFalla(invitaciones.error, "dashboard:invitaciones");

  // Semanas.
  const porSemana = new Map(
    (
      (estudio.data ?? []) as {
        semana: string;
        personas: number;
        nuevas: number;
      }[]
    ).map((fila) => [fila.semana, fila]),
  );
  const cuentaRegistros = contarPorSemana(
    (registros.data ?? []).map((fila) => fila.creado_en as string),
    ahora,
  );
  const cuentaCanjes = contarPorSemana(
    (canjes.data ?? []).map((fila) => fila.fecha_inicio as string),
    ahora,
  );
  const cuentaCertificados = contarPorSemana(
    (certificados.data ?? []).map((fila) => fila.fecha_emision as string),
    ahora,
  );
  const semanas: SemanaInicio[] = semanasRecientes(ahora).semanas.map((semana, i) => ({
    inicio: semana.inicio,
    estudiaron: Number(porSemana.get(semana.inicio)?.personas ?? 0),
    nuevas: Number(porSemana.get(semana.inicio)?.nuevas ?? 0),
    registros: cuentaRegistros[i],
    canjes: cuentaCanjes[i],
    certificados: cuentaCertificados[i],
  }));

  // Cursos.
  const filasResumen = (resumen.data ?? []) as {
    id_curso: string | null;
    empezaron: number;
    terminaron: number;
    personas: number;
  }[];
  const total = filasResumen.find((fila) => fila.id_curso === null);
  const listaCursos = (cursos.data ?? []) as CursoConClases[];
  const cursoPorId = new Map(listaCursos.map((curso) => [curso.id, curso]));
  const cursos30 = filasResumen
    .filter((fila) => fila.id_curso !== null && Number(fila.personas) > 0 && cursoPorId.has(fila.id_curso))
    .map((fila) => {
      const curso = cursoPorId.get(fila.id_curso!)!;
      return {
        id: curso.id,
        slug: curso.slug,
        titulo: curso.titulo,
        personas: Number(fila.personas),
      };
    })
    .sort((a, b) => b.personas - a.personas || a.titulo.localeCompare(b.titulo))
    .slice(0, TOPE_CURSOS);

  const embudo: PasoEmbudo[] = [
    { etiqueta: "Se registraron", personas: metricas.usuariosRegistrados },
    {
      etiqueta: "Tuvieron acceso",
      personas: metricas.usuariosAccesoVigente + metricas.usuariosAccesoVencido,
    },
    { etiqueta: "Empezaron un curso", personas: Number(total?.empezaron ?? 0) },
    {
      etiqueta: "Terminaron un curso",
      personas: Number(total?.terminaron ?? 0),
    },
    {
      etiqueta: "Sacaron el certificado",
      personas: new Set((certificados.data ?? []).map((fila) => fila.id_usuario as string)).size,
    },
  ];

  // Para atender.
  const contenidos = new Set((reportes.data ?? []).map((fila) => (fila.id_respuesta ?? fila.id_post) as string));
  const masAntiguo = (reportes.data ?? []).reduce<string | null>(
    (antes, fila) => (antes === null || (fila.creado_en as string) < antes ? (fila.creado_en as string) : antes),
    null,
  );
  const videosConError = listaCursos
    .map((curso) => ({
      slug: curso.slug,
      titulo: curso.titulo,
      clases: (curso.modulos ?? []).flatMap((modulo) =>
        modulo.lecciones.filter((leccion) => leccion.estado_procesamiento === "ERROR").map((leccion) => leccion.titulo),
      ),
    }))
    .filter((curso) => curso.clases.length > 0);
  const listosParaPublicar = listaCursos
    .filter(
      (curso) =>
        !curso.mostrado &&
        faltasParaPublicar({
          titulo: curso.titulo,
          imagenPortada: curso.imagen_portada,
          modulos: (curso.modulos ?? []).map((modulo) => ({
            lecciones: modulo.lecciones.map((leccion) => ({
              estadoProcesamiento: leccion.estado_procesamiento as "SUBIENDO" | "PROCESANDO" | "LISTO" | "ERROR",
            })),
          })),
        }).length === 0,
    )
    .map((curso) => ({ slug: curso.slug, titulo: curso.titulo }));

  const pendientes = armarPendientes({
    reportes: {
      contenidos: contenidos.size,
      diasMasAntiguo: masAntiguo ? diasEntre(masAntiguo, ahora) : 0,
    },
    examenes,
    videosConError,
    pagosPendientes: pagoPendiente,
    planesVencen: pagos?.vencen ?? 0,
    listosParaPublicar,
    invitacionesSeAcaban: (invitaciones.data ?? []).filter(
      (fila) => diasEntre(ahora.toISOString(), new Date(fila.fecha_renovacion as string)) <= DIAS_AVISO_CODIGOS,
    ).length,
    parados,
  });

  const conAcceso = metricas.usuariosAccesoVigente;
  const pagan = paganHoy + pagoPendiente;
  return {
    semanas,
    pendientes,
    embudo,
    accesoHoy: {
      total: conAcceso,
      invitacion: invitacionHoy,
      pagan,
      uva: Math.max(0, conAcceso - invitacionHoy - pagan),
    },
    cursos30,
    actividad,
    pagos,
  };
}
