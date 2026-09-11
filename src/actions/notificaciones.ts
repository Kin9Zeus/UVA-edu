"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Marca una notificación propia como leída — al hacer clic en ella. */
export async function marcarNotificacionLeida(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("id", id)
    .eq("id_usuario", user.id);
  if (error) return { error: "No pudimos actualizar la notificación." };

  return { success: true };
}

/** Marca todas las notificaciones propias como leídas — botón "Marcar todo
 * como leído" del desplegable. RLS (notificaciones_update_propio) ya acota
 * cualquier UPDATE a la sesión actual; el `.eq("id_usuario", ...)` de acá es
 * explícito por claridad y para no depender en silencio de esa capa sola. */
export async function marcarTodasNotificacionesLeidas(): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("id_usuario", user.id)
    .eq("leida", false);
  if (error) return { error: "No pudimos actualizar las notificaciones." };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
