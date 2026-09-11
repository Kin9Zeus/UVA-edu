"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import type { AdminActionResult } from "@/actions/admin/categorias";
import { MONEDAS_PLAN, NIVELES_ACCESO_PLAN, type PlanInput } from "@/lib/admin/planes-tipos";

function validar(input: PlanInput): string | null {
  if (!input.nombre.trim()) return "El nombre es obligatorio.";
  if (!Number.isFinite(input.precio) || input.precio <= 0) return "El precio debe ser mayor que cero.";
  if (!MONEDAS_PLAN.includes(input.moneda)) return "Selecciona una moneda válida.";
  if (!Number.isInteger(input.duracionDias) || input.duracionDias <= 0) {
    return "La duración debe ser un número de días mayor que cero.";
  }
  if (!NIVELES_ACCESO_PLAN.includes(input.nivelAcceso)) return "Selecciona un nivel de acceso válido.";
  if (!Number.isInteger(input.orden) || input.orden < 0) return "El orden debe ser un número entero, 0 o mayor.";
  return null;
}

export async function crearPlan(input: PlanInput): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const errorValidacion = validar(input);
  if (errorValidacion) return { error: errorValidacion };

  const { data, error } = await admin.supabase
    .from("planes")
    .insert({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion.trim() || null,
      precio_centavos: Math.round(input.precio * 100),
      moneda: input.moneda,
      duracion_dias: input.duracionDias,
      nivel_acceso: input.nivelAcceso,
      orden: input.orden,
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear el plan." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Creó el plan",
    entidadAfectada: "planes",
    idEntidadAfectada: data.id,
    detalles: input.nombre.trim(),
  });

  revalidatePath("/admin/planes");
  revalidatePath("/planes");
  revalidatePath("/dashboard/planes");
  return { success: true };
}

export async function actualizarPlan(id: string, input: PlanInput): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const errorValidacion = validar(input);
  if (errorValidacion) return { error: errorValidacion };

  const { error } = await admin.supabase
    .from("planes")
    .update({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion.trim() || null,
      precio_centavos: Math.round(input.precio * 100),
      moneda: input.moneda,
      duracion_dias: input.duracionDias,
      nivel_acceso: input.nivelAcceso,
      orden: input.orden,
    })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el plan." };

  revalidatePath("/admin/planes");
  revalidatePath("/planes");
  revalidatePath("/dashboard/planes");
  return { success: true };
}

/**
 * Retira o repone un plan del catálogo público sin borrarlo — mismo
 * criterio que el resto de la app (`comunidad_posts.eliminado`,
 * `planes_precios.activo`, etc.): las suscripciones ya otorgadas con este
 * plan (`suscripciones.id_plan`) siguen existiendo y necesitan poder
 * seguir mostrando de qué plan eran, incluso años después de que dejó de
 * venderse.
 */
export async function toggleActivoPlan(id: string, activo: boolean): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("planes").update({ activo }).eq("id", id);
  if (error) return { error: "No pudimos actualizar el plan." };

  revalidatePath("/admin/planes");
  revalidatePath("/planes");
  revalidatePath("/dashboard/planes");
  return { success: true };
}
