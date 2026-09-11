import { createClient } from "@/lib/supabase/server";

export type PlanAdmin = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioCentavos: number;
  moneda: string;
  duracionDias: number;
  nivelAcceso: string | null;
  activo: boolean;
  orden: number;
  /** Suscripciones vivas con este plan (ACTIVA o PAST_DUE) — antes de
   * desactivar un plan, el admin necesita saber si alguien lo sigue
   * pagando. No cuenta VENCIDA/CANCELADA: esas ya no dependen del plan. */
  suscripcionesVigentes: number;
};

export async function getPlanesAdmin(): Promise<PlanAdmin[]> {
  const supabase = await createClient();

  const [{ data: planes }, { data: suscripciones }] = await Promise.all([
    supabase
      .from("planes")
      .select("id, nombre, descripcion, precio_centavos, moneda, duracion_dias, nivel_acceso, activo, orden")
      .order("orden", { ascending: true }),
    supabase.from("suscripciones").select("id_plan, estado").in("estado", ["ACTIVA", "PAST_DUE"]),
  ]);

  const vigentesPorPlan = new Map<string, number>();
  for (const fila of suscripciones ?? []) {
    if (!fila.id_plan) continue;
    vigentesPorPlan.set(fila.id_plan, (vigentesPorPlan.get(fila.id_plan) ?? 0) + 1);
  }

  return (planes ?? []).map((plan) => ({
    id: plan.id,
    nombre: plan.nombre,
    descripcion: plan.descripcion,
    precioCentavos: Number(plan.precio_centavos),
    moneda: plan.moneda,
    duracionDias: plan.duracion_dias,
    nivelAcceso: plan.nivel_acceso,
    activo: plan.activo,
    orden: plan.orden,
    suscripcionesVigentes: vigentesPorPlan.get(plan.id) ?? 0,
  }));
}
