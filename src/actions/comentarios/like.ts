"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LikeComentarioResultado = { error: string } | { success: true };

/**
 * Da o quita like a un comentario. Idempotente en ambos sentidos: dar like
 * ya dado no duplica fila (PK compuesta `(id_comentario, id_usuario)`,
 * upsert la absorbe), quitar un like inexistente simplemente no borra nada.
 */
export async function darLikeComentario(
  comentarioId: string,
  /** Ruta pública de la clase (`/cursos/<slug-curso>/<slug-lección>`), para
   * revalidar exactamente el path que Next.js cacheó — no el UUID interno. */
  ruta: string,
): Promise<LikeComentarioResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("comentario_likes")
    .upsert(
      { id_comentario: comentarioId, id_usuario: user.id },
      { onConflict: "id_comentario,id_usuario", ignoreDuplicates: true },
    );

  if (error) return { error: "No pudimos guardar tu like." };
  revalidatePath(ruta);
  return { success: true };
}

export async function quitarLikeComentario(
  comentarioId: string,
  /** Ruta pública de la clase (`/cursos/<slug-curso>/<slug-lección>`), para
   * revalidar exactamente el path que Next.js cacheó — no el UUID interno. */
  ruta: string,
): Promise<LikeComentarioResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("comentario_likes")
    .delete()
    .eq("id_comentario", comentarioId)
    .eq("id_usuario", user.id);

  if (error) return { error: "No pudimos quitar tu like." };
  revalidatePath(ruta);
  return { success: true };
}
