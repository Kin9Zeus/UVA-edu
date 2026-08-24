import { createClient } from "@/lib/supabase/server";

export type PagoItem = {
  id: string;
  fecha: string;
  monto_centavos: number;
  moneda: string;
  estado: "EXITOSO" | "FALLIDO" | "PENDIENTE";
};

export type SuscripcionActual = {
  id: string;
  planNombre: string;
  duracionDias: number;
  fechaInicio: string;
  fechaRenovacion: string | null;
  estado: "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA";
  pagos: PagoItem[];
};

export async function getSuscripcionActual(usuarioId: string): Promise<SuscripcionActual | null> {
  const supabase = await createClient();

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select(
      "id, fecha_inicio, fecha_renovacion, estado, plan:planes(nombre, duracion_dias), pagos(id, fecha:creado_en, monto_centavos, moneda, estado)",
    )
    .eq("id_usuario", usuarioId)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!suscripcion) return null;

  const plan = Array.isArray(suscripcion.plan) ? suscripcion.plan[0] : suscripcion.plan;

  return {
    id: suscripcion.id,
    planNombre: plan?.nombre ?? "Plan",
    duracionDias: plan?.duracion_dias ?? 30,
    fechaInicio: suscripcion.fecha_inicio,
    fechaRenovacion: suscripcion.fecha_renovacion,
    estado: suscripcion.estado,
    pagos: (suscripcion.pagos ?? [])
      .slice()
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
  };
}
