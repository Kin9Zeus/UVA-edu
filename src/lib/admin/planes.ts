import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";

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
};

export async function getPlanesAdmin(): Promise<PlanAdmin[]> {
  const supabase = await createClient();

  const { data: planes, error } = await supabase
    .from("planes")
    .select("id, nombre, descripcion, precio_centavos, moneda, duracion_dias, nivel_acceso, activo, orden")
    .order("orden", { ascending: true });
  lanzarSiFalla(error, "planes:planes");

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
  }));
}
