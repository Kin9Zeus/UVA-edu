"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { generarCodigoInvitacion } from "@/lib/codigoInvitacion";
import type { AdminActionResult } from "@/actions/admin/categorias";

/** Intentos de generar un código libre antes de rendirse. */
const INTENTOS_CODIGO_UNICO = 5;

/**
 * Tope de días que puede otorgar un código. No lo impone la base: es un
 * freno a la equivocación de teclado (escribir 3650 en vez de 365 regala
 * diez años de acceso, y revertirlo obliga a editar la suscripción ya
 * creada). Súbelo si el negocio alguna vez necesita más.
 */
const MAX_DURACION_DIAS = 730;

/**
 * Valida lo común a crear y editar: la fecha debe ser futura y el límite un
 * entero positivo.
 *
 * `limiteUsos` es obligatorio, no opcional: la regla de negocio del
 * lanzamiento es que un código sea de uso único o con tope, nunca
 * ilimitado. La base lo respalda con NOT NULL + CHECK >= 1
 * (`codigos_invitacion_limite_usos_positivo`), así que esto solo adelanta
 * el mensaje de error para que no llegue como un fallo genérico de insert.
 */
function validar(input: { fechaVencimiento: string; limiteUsos: number }): string | null {
  const vence = new Date(input.fechaVencimiento);
  if (Number.isNaN(vence.getTime())) return "La fecha de vencimiento no es válida.";
  if (vence.getTime() <= Date.now()) return "La fecha de vencimiento debe ser futura.";

  if (!Number.isInteger(input.limiteUsos) || input.limiteUsos < 1) {
    return "El límite de usos debe ser un número entero mayor que cero.";
  }

  return null;
}

/** Los días de acceso solo se fijan al crear: ver el comentario de `actualizar`. */
function validarDuracion(duracionDias: number): string | null {
  if (!Number.isInteger(duracionDias) || duracionDias < 1) {
    return "Los días de acceso deben ser un número entero mayor que cero.";
  }
  if (duracionDias > MAX_DURACION_DIAS) {
    return `Los días de acceso no pueden superar ${MAX_DURACION_DIAS}.`;
  }
  return null;
}

/**
 * Crea un código de invitación: al canjearse otorga una suscripción activa
 * y gratuita por los días indicados (ver
 * supabase/sql/035_canje_codigo_por_dias.sql).
 *
 * `duracionDias` reemplaza al antiguo `planId`. Un código no vende un plan:
 * regala un periodo de acceso que el administrador fija libremente, sin
 * tener que traducir "quiero dar 45 días" a "elijo el plan que dure 45
 * días" ni inventarse un plan cuando ninguno cuadra.
 */
export async function crearCodigoInvitacion(input: {
  duracionDias: number;
  fechaVencimiento: string;
  limiteUsos: number;
}): Promise<AdminActionResult & { codigo?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const duracionInvalida = validarDuracion(input.duracionDias);
  if (duracionInvalida) return { error: duracionInvalida };

  const invalido = validar(input);
  if (invalido) return { error: invalido };

  // `codigo` es UNIQUE. La probabilidad de choque es ínfima (31^8), pero
  // reintentar es más barato que devolverle un error al administrador por
  // una colisión que se resuelve sola generando otro.
  for (let intento = 0; intento < INTENTOS_CODIGO_UNICO; intento += 1) {
    const codigo = generarCodigoInvitacion();

    const { error } = await admin.supabase.from("codigos_invitacion").insert({
      codigo,
      duracion_dias: input.duracionDias,
      id_admin_creador: admin.adminId,
      fecha_vencimiento: new Date(input.fechaVencimiento).toISOString(),
      limite_usos: input.limiteUsos,
      activo: true,
    });

    if (!error) {
      await registrarBitacora(admin.supabase, {
        idAdmin: admin.adminId,
        accion: "Creó un código de invitación",
        entidadAfectada: "codigos_invitacion",
        detalles: `${codigo} — ${input.duracionDias} día(s) de acceso, ${input.limiteUsos} uso(s)`,
      });

      revalidatePath("/admin/codigos");
      return { success: true, codigo };
    }

    // 23505 = unique_violation: solo en ese caso tiene sentido reintentar.
    if (error.code !== "23505") return { error: "No pudimos crear el código." };
  }

  return { error: "No pudimos generar un código libre. Intenta de nuevo." };
}

/**
 * Edita un código existente. Solo se pueden cambiar la fecha de vencimiento
 * y el límite de usos.
 *
 * El código en sí y sus días de acceso son inmutables a propósito: ya se
 * compartieron y ya se canjearon con esas condiciones. Cambiar la duración
 * de un código usado dejaría suscripciones existentes apuntando a un código
 * que dice otra cosa de la que les dio acceso — y no las corregiría, porque
 * su `fecha_renovacion` se calculó en el momento del canje.
 */
export async function actualizarCodigoInvitacion(
  id: string,
  input: { fechaVencimiento: string; limiteUsos: number },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const invalido = validar(input);
  if (invalido) return { error: invalido };

  const { data: actual } = await admin.supabase
    .from("codigos_invitacion")
    .select("codigo, veces_usado")
    .eq("id", id)
    .maybeSingle();

  if (!actual) return { error: "Ese código ya no existe." };

  // Bajar el límite por debajo de los canjes ya hechos no invalida nada
  // retroactivamente (esas suscripciones siguen vivas), pero deja el código
  // en un estado confuso: agotado y con veces_usado por encima del tope.
  if (input.limiteUsos < (actual.veces_usado as number)) {
    return {
      error: `Ese código ya se canjeó ${actual.veces_usado} vez/veces: el límite no puede ser menor.`,
    };
  }

  const { error } = await admin.supabase
    .from("codigos_invitacion")
    .update({
      fecha_vencimiento: new Date(input.fechaVencimiento).toISOString(),
      limite_usos: input.limiteUsos,
    })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el código." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Editó un código de invitación",
    entidadAfectada: "codigos_invitacion",
    idEntidadAfectada: id,
    detalles: actual.codigo as string,
  });

  revalidatePath("/admin/codigos");
  return { success: true };
}

/** Activa o desactiva un código sin borrarlo. */
export async function toggleActivoCodigoInvitacion(
  id: string,
  activo: boolean,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase
    .from("codigos_invitacion")
    .update({ activo })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el código." };

  revalidatePath("/admin/codigos");
  return { success: true };
}

/**
 * Elimina un código, SOLO si nunca se canjeó.
 *
 * `suscripciones.id_codigo_invitacion` es ON DELETE SET NULL: borrar un
 * código ya usado no rompe nada visible, pero deja las suscripciones que
 * salieron de él sin rastro de su origen — y esas son justo las de acceso
 * gratuito, las que más conviene poder auditar. Un código gastado se
 * desactiva; borrar se reserva para los que se crearon por error.
 */
export async function eliminarCodigoInvitacion(id: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { data: codigo } = await admin.supabase
    .from("codigos_invitacion")
    .select("codigo, veces_usado")
    .eq("id", id)
    .maybeSingle();

  if (!codigo) return { error: "Ese código ya no existe." };

  if ((codigo.veces_usado as number) > 0) {
    return {
      error:
        "No se puede eliminar un código ya canjeado, porque las suscripciones que otorgó perderían su origen. Desactívalo en su lugar.",
    };
  }

  const { error } = await admin.supabase.from("codigos_invitacion").delete().eq("id", id);
  if (error) return { error: "No pudimos eliminar el código." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Eliminó un código de invitación sin usar",
    entidadAfectada: "codigos_invitacion",
    idEntidadAfectada: id,
    detalles: codigo.codigo as string,
  });

  revalidatePath("/admin/codigos");
  return { success: true };
}
