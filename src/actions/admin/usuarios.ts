"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminActionResult } from "@/actions/admin/categorias";
import { logError } from "@/lib/log";

export async function suspenderActivarUsuario(
  usuarioId: string,
  nuevoEstado: "ACTIVO" | "SUSPENDIDO",
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase
    .from("perfiles")
    .update({ estado: nuevoEstado })
    .eq("id", usuarioId);

  if (error) return { error: "No pudimos actualizar el estado del usuario." };

  // Revocación proactiva: el chequeo de estado en proxy.ts solo actúa en la
  // próxima request del usuario, así que sin esto una sesión ya abierta
  // sigue siendo válida (JWT no expirado) hasta que expire por su cuenta.
  // No aborta la acción si falla: el estado ya quedó bien en la DB, que es
  // lo importante, y el trigger perfiles_bloquea_autopromocion +
  // private.cuenta_activa() (018_cuenta_activa_rls.sql) siguen cerrando el
  // acceso aunque el signOut global no se haya podido ejecutar.
  if (nuevoEstado === "SUSPENDIDO") {
    const { error: errorSignOut } = await createAdminClient().auth.admin.signOut(usuarioId, "global");
    if (errorSignOut) {
      logError("admin/usuarios", "No se pudo revocar la sesión del usuario suspendido", errorSignOut, {
        usuarioId,
      });
    }
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: nuevoEstado === "SUSPENDIDO" ? "Suspendió una cuenta" : "Activó una cuenta",
    entidadAfectada: "perfiles",
    idEntidadAfectada: usuarioId,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return { success: true };
}

/**
 * Otorga acceso manual a una membresía (docs/functional-spec.md Flujo 11):
 * crea una Suscripción con acceso_manual = true y otorgado_por = admin. No
 * pasa por Stripe/Wompi — es el equivalente a "otorgar membresía" del
 * prompt-panel-admin-claude-code.md.
 */
export async function otorgarMembresia(usuarioId: string, planId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { data: plan, error: errorPlan } = await admin.supabase
    .from("planes")
    .select("id, nombre, precio_centavos, moneda, duracion_dias")
    .eq("id", planId)
    .single();

  if (errorPlan || !plan) return { error: "No encontramos el plan seleccionado." };

  const fechaInicio = new Date();
  const fechaRenovacion = new Date(fechaInicio);
  fechaRenovacion.setDate(fechaRenovacion.getDate() + plan.duracion_dias);

  const { error } = await admin.supabase.from("suscripciones").insert({
    id_usuario: usuarioId,
    id_plan: plan.id,
    fecha_inicio: fechaInicio.toISOString(),
    fecha_renovacion: fechaRenovacion.toISOString(),
    estado: "ACTIVA",
    proveedor: "manual",
    monto_centavos: plan.precio_centavos,
    moneda: plan.moneda,
    acceso_manual: true,
    otorgado_por: admin.adminId,
  });

  if (error) return { error: "No pudimos otorgar la membresía." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Otorgó una membresía manual",
    entidadAfectada: "suscripciones",
    idEntidadAfectada: usuarioId,
    detalles: `Plan: ${plan.nombre}`,
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/usuarios");
  return { success: true };
}

export async function ofrecerCortesia(usuarioId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("inscripciones").insert({
    id_usuario: usuarioId,
    id_curso: cursoId,
    otorgado_por: admin.adminId,
    tipo_acceso: "CORTESIA",
  });

  if (error) {
    return {
      error: error.code === "23505" ? "El usuario ya tiene acceso a este curso." : "No pudimos otorgar la cortesía.",
    };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Otorgó un curso de cortesía",
    entidadAfectada: "inscripciones",
    idEntidadAfectada: usuarioId,
    detalles: `Curso: ${cursoId}`,
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return { success: true };
}

export async function quitarCortesia(inscripcionId: string, usuarioId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase
    .from("inscripciones")
    .delete()
    .eq("id", inscripcionId)
    .eq("tipo_acceso", "CORTESIA");

  if (error) return { error: "No pudimos quitar la cortesía." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Quitó un curso de cortesía",
    entidadAfectada: "inscripciones",
    idEntidadAfectada: inscripcionId,
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return { success: true };
}
