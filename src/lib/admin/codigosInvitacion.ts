import { createClient } from "@/lib/supabase/server";
import { estadoCodigo, type EstadoCodigo } from "@/lib/codigoInvitacion";

export type CodigoInvitacion = {
  id: string;
  codigo: string;
  planId: string;
  planNombre: string;
  fechaVencimiento: string;
  /** null = sin límite de usos. */
  limiteUsos: number | null;
  vecesUsado: number;
  activo: boolean;
  estado: EstadoCodigo;
  creadoPor: string;
  creadoEn: string;
};

export type PlanOpcion = { id: string; nombre: string; duracionDias: number };

export async function getCodigosInvitacion(): Promise<CodigoInvitacion[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("codigos_invitacion")
    .select(
      "id, codigo, id_plan, fecha_vencimiento, limite_usos, veces_usado, activo, creado_en, plan:planes(nombre), admin_creador:perfiles(nombre)",
    )
    .order("creado_en", { ascending: false });

  return (data ?? []).map((fila) => {
    const plan = Array.isArray(fila.plan) ? fila.plan[0] : fila.plan;
    const adminCreador = Array.isArray(fila.admin_creador)
      ? fila.admin_creador[0]
      : fila.admin_creador;

    return {
      id: fila.id as string,
      codigo: fila.codigo as string,
      planId: fila.id_plan as string,
      planNombre: plan?.nombre ?? "Plan eliminado",
      fechaVencimiento: fila.fecha_vencimiento as string,
      limiteUsos: fila.limite_usos as number | null,
      vecesUsado: fila.veces_usado as number,
      activo: fila.activo as boolean,
      // El estado no se guarda: se deriva de los tres campos que lo
      // determinan, con el mismo orden de precedencia que aplica el RPC de
      // canje (017). Guardarlo obligaría a un cron que lo mantuviera al día.
      estado: estadoCodigo({
        activo: fila.activo as boolean,
        fechaVencimiento: fila.fecha_vencimiento as string,
        limiteUsos: fila.limite_usos as number | null,
        vecesUsado: fila.veces_usado as number,
      }),
      creadoPor: adminCreador?.nombre ?? "—",
      creadoEn: fila.creado_en as string,
    };
  });
}

/** Planes activos, para el selector del formulario. */
export async function getPlanesParaCodigos(): Promise<PlanOpcion[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("planes")
    .select("id, nombre, duracion_dias")
    .eq("activo", true)
    .order("orden");

  return (data ?? []).map((plan) => ({
    id: plan.id as string,
    nombre: plan.nombre as string,
    duracionDias: plan.duracion_dias as number,
  }));
}
