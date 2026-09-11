"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * Fija o desfija una publicación en el feed. Solo un administrador — el
 * trigger `comunidad_posts_transiciones_permitidas` (083_comunidad.sql) ya
 * lo exige a nivel de base, esto es la misma regla para un mensaje legible
 * en vez de que el UPDATE falle con el texto crudo del trigger.
 *
 * Usa `AdminActionResult` (no un tipo propio de error/success estricto):
 * `requireAdmin()` no declara un tipo de retorno explícito, y TypeScript no
 * angosta `admin.error` a `string` de forma limpia con un discriminated
 * union estricto de 3+ ramas — mismo motivo por el que el resto de
 * src/actions/admin/*.ts ya usa esta forma más laxa en vez de una propia.
 */
export async function fijarPostComunidad(
  postId: string,
  fijado: boolean,
  ruta: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("comunidad_posts").update({ fijado }).eq("id", postId);

  if (error) return { error: "No pudimos actualizar la publicación." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: fijado ? "Fijó una publicación de Comunidad" : "Desfijó una publicación de Comunidad",
    entidadAfectada: "comunidad_posts",
    idEntidadAfectada: postId,
  });

  revalidatePath(ruta);
  return { success: true };
}
