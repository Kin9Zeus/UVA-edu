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
 *
 * Además de marcar `eliminado`, vacía `contenido`: RLS protege filas, no
 * columnas, así que dejar el texto ahí permitía a cualquiera con acceso a
 * la lección leer el "comentario eliminado" completo directo desde el
 * cliente — el enmascarado a "[comentario eliminado]" en
 * src/lib/comentarios.ts solo aplica del lado del servidor de Next, no
 * evita una consulta directa a Supabase con la anon key.
 *
 * Si quien borra es un administrador moderando el comentario de otra
 * persona (no su propio autor), el texto se copia antes a
 * `comentario_moderacion` — con RLS solo-admin — para no perder la
 * evidencia de un comentario abusivo.
 */
export async function eliminarComentario(
  comentarioId: string,
  /** Ruta pública de la clase (`/cursos/<slug-curso>/<slug-lección>`), para
   * revalidar exactamente el path que Next.js cacheó — no el UUID interno. */
  ruta: string,
): Promise<EliminarComentarioResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: comentario, error: errorLectura } = await supabase
    .from("comentarios")
    .select("id_usuario, contenido, eliminado")
    .eq("id", comentarioId)
    .maybeSingle();

  if (errorLectura) return { error: "No pudimos eliminar el comentario." };
  if (!comentario) return { error: "El comentario ya no existe." };
  if (comentario.eliminado) return { success: true };

  const esAutor = comentario.id_usuario === user.id;
  let esAdmin = false;
  if (!esAutor) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
    esAdmin = perfil?.rol === "ADMINISTRADOR";
  }
  if (!esAutor && !esAdmin) return { error: "No tienes permiso para eliminar este comentario." };

  if (esAdmin) {
    const { error: errorModeracion } = await supabase.from("comentario_moderacion").insert({
      id_comentario: comentarioId,
      contenido_original: comentario.contenido,
      id_eliminado_por: user.id,
    });
    if (errorModeracion) return { error: "No pudimos eliminar el comentario." };
  }

  const { error } = await supabase
    .from("comentarios")
    .update({ eliminado: true, contenido: "" })
    .eq("id", comentarioId);

  if (error) return { error: "No pudimos eliminar el comentario." };

  revalidatePath(ruta);
  return { success: true };
}
