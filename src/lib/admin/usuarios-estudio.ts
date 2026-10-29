import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { semanasRecientes } from "@/lib/admin/semanas";
import { contarUsuarios } from "@/lib/admin/usuarios";
import { getMetricasPanel } from "@/lib/admin/metricas";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { PROVEEDORES_PASARELA } from "@/lib/pagos/proveedores";
import type { SemanaGrafica } from "@/lib/admin/grafica";

/** Una semana: cuántas personas estudiaron, y dos repartos para el detalle. */
export type SemanaEstudio = SemanaGrafica & { nuevas: number; volvieron: number; pagan: number };

export type FilaEstudioSemana = { semana: string; personas: number; nuevas: number; pagan: number };

export type ResumenUsuarios = {
  semanas: SemanaEstudio[];
  /** Si se cuentan pagos: con el cobro apagado las cifras de pago no aplican. */
  conCobro: boolean;
  estudiaronSemana: number;
  conAcceso: number;
  parados: number;
  /** De los parados, cuántos pagan. */
  paradosPagan: number;
  sinAcceso: number;
  vencidos: number;
  paganHoy: number;
  pagoPendiente: number;
  /** Personas a quienes se les acabó el acceso por invitación. */
  invitacionTerminada: number;
  /** De esas, cuántas compraron un plan después. */
  pagaronDespues: number;
};

/** Pone las filas de `admin_estudio_por_semana` en las 12 semanas de la gráfica. */
export function resumirSemanas(filas: FilaEstudioSemana[], ahora: Date = new Date()): SemanaEstudio[] {
  const porSemana = new Map(filas.map((fila) => [fila.semana, fila]));
  return semanasRecientes(ahora).semanas.map((semana) => {
    const fila = porSemana.get(semana.inicio);
    const personas = fila?.personas ?? 0;
    const nuevas = fila?.nuevas ?? 0;
    return {
      ...semana,
      total: personas,
      porSerie: { personas },
      nuevas,
      volvieron: personas - nuevas,
      pagan: fila?.pagan ?? 0,
    };
  });
}

type AccesoHistorico = { idUsuario: string; proveedor: string; inicio: string; fin: string | null };

/**
 * De invitación a pago: entre quienes ya se les acabó un acceso por código,
 * cuántos compraron un plan después de empezar esa invitación. Pura para
 * probarla sin base.
 */
export function deInvitacionAPago(accesos: AccesoHistorico[], ahora: Date = new Date()) {
  const primeraInvitacion = new Map<string, string>();
  for (const a of accesos) {
    if (a.proveedor !== "invitacion" || !a.fin || new Date(a.fin) > ahora) continue;
    const previa = primeraInvitacion.get(a.idUsuario);
    if (!previa || a.inicio < previa) primeraInvitacion.set(a.idUsuario, a.inicio);
  }
  const pagaron = new Set(
    accesos
      .filter((a) => (PROVEEDORES_PASARELA as readonly string[]).includes(a.proveedor))
      .filter((a) => {
        const invitacion = primeraInvitacion.get(a.idUsuario);
        return invitacion !== undefined && a.inicio >= invitacion;
      })
      .map((a) => a.idUsuario),
  );
  return { invitacionTerminada: primeraInvitacion.size, pagaronDespues: pagaron.size };
}

export async function getDeInvitacionAPago(ahora: Date) {
  const supabase = await createClient();
  // ponytail: trae toda la historia de accesos por código y pagados; con
  // decenas de miles de filas, contarlo en una función de Postgres.
  const { data, error } = await supabase
    .from("suscripciones")
    .select("id_usuario, proveedor, fecha_inicio, fecha_renovacion")
    .in("proveedor", ["invitacion", ...PROVEEDORES_PASARELA]);
  lanzarSiFalla(error, "usuarios-estudio:suscripciones");
  return deInvitacionAPago(
    (data ?? []).map((fila) => ({
      idUsuario: fila.id_usuario as string,
      proveedor: fila.proveedor as string,
      inicio: fila.fecha_inicio as string,
      fin: (fila.fecha_renovacion as string | null) ?? null,
    })),
    ahora,
  );
}

/**
 * La gráfica y las cifras de Usuarios. Las cifras se cuentan con el mismo RPC
 * que la tabla (`contarUsuarios`): así, al tocar una, la tabla filtrada
 * muestra exactamente ese número de personas.
 */
export async function getResumenUsuarios(ahora: Date = new Date()): Promise<ResumenUsuarios> {
  const supabase = await createClient();
  const { primerLunes } = semanasRecientes(ahora);

  const [semanas, metricas, estudiaronSemana, parados, sinAcceso, vencidos] = await Promise.all([
    supabase.rpc("admin_estudio_por_semana", { p_desde: primerLunes }).then(({ data, error }) => {
      lanzarSiFalla(error, "usuarios-estudio:admin_estudio_por_semana");
      return resumirSemanas(
        ((data ?? []) as { semana: string; personas: number; nuevas: number; pagan: number }[]).map((fila) => ({
          semana: fila.semana,
          personas: Number(fila.personas),
          nuevas: Number(fila.nuevas),
          pagan: Number(fila.pagan),
        })),
        ahora,
      );
    }),
    getMetricasPanel(),
    contarUsuarios({ estudio: "SEMANA" }),
    contarUsuarios({ estudio: "PARADOS" }),
    contarUsuarios({ suscripcion: "SIN_SUSCRIPCION" }),
    contarUsuarios({ suscripcion: "VENCIDA" }),
  ]);

  const cobro = PRECIOS_HABILITADOS
    ? await Promise.all([
        contarUsuarios({ origen: "PAGO", suscripcion: "ACTIVA" }),
        contarUsuarios({ origen: "PAGO", suscripcion: "PAST_DUE" }),
        contarUsuarios({ origen: "PAGO", estudio: "PARADOS" }),
        getDeInvitacionAPago(ahora),
      ])
    : null;

  return {
    semanas,
    conCobro: PRECIOS_HABILITADOS,
    estudiaronSemana,
    conAcceso: metricas.usuariosAccesoVigente,
    parados,
    paradosPagan: cobro?.[2] ?? 0,
    sinAcceso,
    vencidos,
    paganHoy: cobro?.[0] ?? 0,
    pagoPendiente: cobro?.[1] ?? 0,
    invitacionTerminada: cobro?.[3].invitacionTerminada ?? 0,
    pagaronDespues: cobro?.[3].pagaronDespues ?? 0,
  };
}
