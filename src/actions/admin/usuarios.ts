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

  // Cierra cualquier suscripción vieja que ya venció por fecha pero que
  // nada había marcado como tal (private.suscripcion_da_acceso, 038): sin
  // esto, el insert de abajo choca contra `suscripcion_activa_unica_por_usuario`
  // en cuanto el usuario tuvo una invitación caducada, con un 23505 crudo en
  // vez de un mensaje legible (supabase/sql/041).
  const { error: errorCierre } = await admin.supabase.rpc("cerrar_suscripcion_caducada_admin", {
    p_usuario_id: usuarioId,
  });
  if (errorCierre) return { error: "No pudimos otorgar la membresía." };

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

  // El índice único (id_usuario, id_curso) sigue vivo aunque una fila esté
  // revocada (quitarCortesia ya no borra, ver f4accesos.md) -- un INSERT
  // directo chocaría contra la fila vieja con 23505 aunque esté inactiva.
  // Si existe, se reactiva la misma fila en vez de crear una segunda: es
  // la forma en que "revocar y volver a otorgar" queda consistente con el
  // índice sin tener que convertirlo en uno parcial.
  const { data: existente } = await admin.supabase
    .from("inscripciones")
    .select("id, activo")
    .eq("id_usuario", usuarioId)
    .eq("id_curso", cursoId)
    .maybeSingle();

  if (existente?.activo) {
    return { error: "El usuario ya tiene acceso a este curso." };
  }

  const { error } = existente
    ? await admin.supabase
        .from("inscripciones")
        .update({
          activo: true,
          tipo_acceso: "CORTESIA",
          otorgado_por: admin.adminId,
          revocado_en: null,
          motivo_revocacion: null,
          revocado_por: null,
        })
        .eq("id", existente.id)
    : await admin.supabase.from("inscripciones").insert({
        id_usuario: usuarioId,
        id_curso: cursoId,
        otorgado_por: admin.adminId,
        tipo_acceso: "CORTESIA",
      });

  if (error) return { error: "No pudimos otorgar la cortesía." };

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

/**
 * Revoca una cortesía (f4accesos.md): NO borra la fila, la marca inactiva
 * con fecha (`revocado_en`), motivo y qué admin la ejecutó. El corte de
 * acceso real lo hacen `obtenerAccesoAlCurso` (src/lib/accesoCurso.ts, usada
 * por lib/leccion.ts, lib/curso.ts y lib/video/reproduccion.ts) y las
 * policies de RLS (039_revocacion_cortesia.sql), que ahora exigen
 * `activo = true` — no el borrado en sí.
 */
export async function quitarCortesia(
  inscripcionId: string,
  usuarioId: string,
  motivo: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const motivoLimpio = motivo.trim();
  if (!motivoLimpio) return { error: "Escribe el motivo de la revocación." };

  const { error } = await admin.supabase
    .from("inscripciones")
    .update({
      activo: false,
      revocado_en: new Date().toISOString(),
      motivo_revocacion: motivoLimpio,
      revocado_por: admin.adminId,
    })
    .eq("id", inscripcionId)
    .eq("tipo_acceso", "CORTESIA");

  if (error) return { error: "No pudimos quitar la cortesía." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Revocó un curso de cortesía",
    entidadAfectada: "inscripciones",
    // usuarioId, no inscripcionId: mismo criterio que ofrecerCortesia() y
    // revocarMembresia() — la bitácora resuelve "a quién" enlazando
    // id_entidad_afectada a /admin/usuarios/[id], y ahí solo sirve un id de
    // usuario.
    idEntidadAfectada: usuarioId,
    detalles: motivoLimpio,
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return { success: true };
}

/**
 * Revoca una membresía manual (f4accesos.md): cierra la suscripción como
 * `CANCELADA` — estado que `suscripcionDaAcceso`/`private.suscripcion_da_acceso`
 * (038_vigencia_por_fecha.sql) ya excluyen del acceso vigente, así que no
 * hace falta ninguna regla nueva de RLS para que el corte surta efecto en
 * la siguiente petición. Solo puede revocarse una suscripción que el admin
 * otorgó a mano (`acceso_manual`): una de Stripe/Wompi no tiene todavía un
 * flujo de cancelación diseñado y no es lo que pide este documento.
 */
export async function revocarMembresia(
  suscripcionId: string,
  usuarioId: string,
  motivo: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const motivoLimpio = motivo.trim();
  if (!motivoLimpio) return { error: "Escribe el motivo de la revocación." };

  const { data: suscripcion } = await admin.supabase
    .from("suscripciones")
    .select("id, id_usuario, acceso_manual, estado")
    .eq("id", suscripcionId)
    .single();

  if (!suscripcion || suscripcion.id_usuario !== usuarioId || !suscripcion.acceso_manual) {
    return { error: "No encontramos esa membresía manual." };
  }
  if (suscripcion.estado === "CANCELADA") {
    return { error: "Esa membresía ya está cancelada." };
  }

  const { error } = await admin.supabase
    .from("suscripciones")
    .update({
      estado: "CANCELADA",
      motivo_cancelacion: motivoLimpio,
      cancelado_por: admin.adminId,
    })
    .eq("id", suscripcionId);

  if (error) return { error: "No pudimos revocar la membresía." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Revocó una membresía manual",
    entidadAfectada: "suscripciones",
    idEntidadAfectada: usuarioId,
    detalles: motivoLimpio,
  });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/usuarios");
  return { success: true };
}
