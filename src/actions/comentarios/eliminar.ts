"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EliminarComentarioResultado = { error: string } | { success: true };

/**
 * Borrado lógico: marca `eliminado = true` en vez de DELETE, para que las
 * respuestas de un comentario raíz borrado no queden huérfanas de contexto
 * (ver el comentario del modelo Comentarios en schema.prisma). La policy
 * `comentarios_update_propio_o_admin` (052_comentarios.sql) ya limita esto
 * al autor o a un administrador — se repite acá para un mensaje de error
 * legible en vez de dejar que RLS lo rechace en silencio (0 filas
 * afectadas, sin excepción).
 */
export async function eliminarComentario(
  cursoId: string,
  leccionId: string,
  comentarioId: string,
): Promise<EliminarComentarioResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data, error } = await supabase
    .from("comentarios")
    .update({ eliminado: true })
    .eq("id", comentarioId)
    .select("id")
    .maybeSingle();

  if (error) return { error: "No pudimos eliminar el comentario." };
  if (!data) return { error: "No tienes permiso para eliminar este comentario." };

  revalidatePath(`/cursos/${cursoId}/${leccionId}`);
  return { success: true };
}
