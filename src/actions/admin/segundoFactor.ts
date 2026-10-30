"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { createAdminClient } from "@/lib/supabase/admin";
import { esUuid } from "@/lib/slug";
import { logError } from "@/lib/log";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * Quitar la verificación en dos pasos de OTRO administrador — FASE 8.1.
 *
 * Es el camino de recuperación cuando alguien pierde su celular y no registró
 * un segundo dispositivo: otro administrador le quita el factor y, al volver a
 * entrar, la persona registra uno nuevo. Por eso es peligrosa: en manos de un
 * impostor que convenció a un administrador por chat, abriría la cuenta de
 * otro. La pantalla exige escribir el correo de la cuenta y recuerda confirmar
 * la identidad por otro canal (una videollamada, nunca un mensaje), y queda en
 * la bitácora.
 *
 * Usa la API de administración de Supabase (llave de servicio): la normal solo
 * deja quitar factores propios.
 */
export async function quitarSegundoFactorDeAdmin(usuarioId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  if (!esUuid(usuarioId)) return { error: "Usuario no válido." };
  // La propia se cambia en Mi perfil, donde se exige añadir otra antes de
  // quitar la última. Desde aquí, alguien podría dejarse sin ninguna.
  if (usuarioId === admin.adminId) return { error: "Tu propia verificación se cambia en Mi perfil." };

  const { data: perfil, error: errorPerfil } = await admin.supabase
    .from("perfiles")
    .select("rol")
    .eq("id", usuarioId)
    .maybeSingle();
  if (errorPerfil) {
    logError("admin:quitarSegundoFactor", "no se pudo leer el perfil", errorPerfil, { usuarioId });
    return { error: "No pudimos comprobar la cuenta. Intenta de nuevo." };
  }
  if (!perfil) return { error: "La cuenta ya no existe." };
  if (perfil.rol !== "ADMINISTRADOR") return { error: "Solo los administradores tienen verificación en dos pasos." };

  const servicio = createAdminClient();
  const { data, error: errorFactores } = await servicio.auth.admin.mfa.listFactors({ userId: usuarioId });
  if (errorFactores) {
    logError("admin:quitarSegundoFactor", "listFactors falló", errorFactores, { usuarioId });
    return { error: "No pudimos quitar la verificación. Intenta de nuevo." };
  }

  const factores = data?.factors ?? [];
  if (factores.length === 0) return { error: "Esta cuenta no tiene la verificación activada." };

  for (const factor of factores) {
    const { error } = await servicio.auth.admin.mfa.deleteFactor({ id: factor.id, userId: usuarioId });
    if (error) {
      logError("admin:quitarSegundoFactor", "deleteFactor falló", error, { usuarioId, factorId: factor.id });
      // Lo que ya se borró, borrado queda: se dice la verdad en vez de
      // anunciar un éxito a medias.
      return { error: "No pudimos quitar toda la verificación. Vuelve a intentarlo." };
    }
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Quitó la verificación en dos pasos de otro administrador",
    entidadAfectada: "perfiles",
    idEntidadAfectada: usuarioId,
    detalles: `${factores.length} dispositivo(s) quitados`,
  });

  revalidatePath("/admin/usuarios");
  return { success: true };
}
