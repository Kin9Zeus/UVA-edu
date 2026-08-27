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
  /** true si no pasó por Stripe/Wompi: la otorgó un admin o vino de un código de invitación. */
  accesoManual: boolean;
  /** Distingue, dentro de un acceso manual, si el estudiante lo canjeó él mismo o si un admin lo otorgó directo. */
  tieneCodigoInvitacion: boolean;
};

export async function getSuscripcionActual(usuarioId: string): Promise<SuscripcionActual | null> {
  const supabase = await createClient();

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select(
      "id, fecha_inicio, fecha_renovacion, estado, acceso_manual, id_codigo_invitacion, plan:planes(nombre, duracion_dias), pagos(id, fecha:creado_en, monto_centavos, moneda, estado)",
    )
    .eq("id_usuario", usuarioId)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!suscripcion) return null;

  const plan = Array.isArray(suscripcion.plan) ? suscripcion.plan[0] : suscripcion.plan;

  // Sin plan = acceso otorgado por un código de invitación: esas
  // suscripciones se crean con `id_plan` NULL porque nadie compró nada
  // (035_canje_codigo_por_dias.sql). Decir "Plan" a secas ahí sugería una
  // compra que no existió.
  //
  // `duracionDias` cae a los días reales entre inicio y fin en vez de a un
  // 30 fijo: es el dato que el código otorgó, y la barra de vigencia del
  // perfil lo usa para calcular cuánto se lleva consumido.
  const duracionReal =
    suscripcion.fecha_renovacion !== null
      ? Math.max(
          1,
          Math.round(
            (new Date(suscripcion.fecha_renovacion).getTime() -
              new Date(suscripcion.fecha_inicio).getTime()) /
              86_400_000,
          ),
        )
      : 30;

  return {
    id: suscripcion.id,
    planNombre: plan?.nombre ?? "Acceso por invitación",
    duracionDias: plan?.duracion_dias ?? duracionReal,
    fechaInicio: suscripcion.fecha_inicio,
    fechaRenovacion: suscripcion.fecha_renovacion,
    estado: suscripcion.estado,
    pagos: (suscripcion.pagos ?? [])
      .slice()
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    accesoManual: suscripcion.acceso_manual,
    tieneCodigoInvitacion: suscripcion.id_codigo_invitacion !== null,
  };
}
