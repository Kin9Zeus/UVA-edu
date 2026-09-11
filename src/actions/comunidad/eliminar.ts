"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { borrarAdjuntoComunidad } from "@/lib/comunidad-adjuntos";

export type EliminarComunidadResultado = { error: string } | { success: true };

/**
 * Borra TODOS los adjuntos de un post/respuesta ya marcado como eliminado
 * — sin excepción para moderación: a diferencia del texto (que sí se
 * preserva en `comunidad_moderacion` como evidencia), los archivos se
 * eliminan siempre. El usuario lo pidió explícito ("si un post se elimina
 * se debería eliminar todo lo relacionado"), y a diferencia del texto un
 * archivo no aporta nada a una revisión de moderación que una captura de
 * pantalla del admin ya no pueda cubrir en el momento.
 */
async function eliminarAdjuntosComunidad(
  supabase: SupabaseClient,
  filtro: { idPost: string } | { idRespuesta: string },
) {
  const columna = "idPost" in filtro ? "id_post" : "id_respuesta";
  const valor = "idPost" in filtro ? filtro.idPost : filtro.idRespuesta;

  const { data: adjuntos } = await supabase.from("comunidad_adjuntos").select("id, ruta_storage").eq(columna, valor);
  for (const adjunto of adjuntos ?? []) {
    await borrarAdjuntoComunidad(supabase, adjunto.id, adjunto.ruta_storage);
  }
}

/**
 * Borrado lógico de una publicación: marca `eliminado = true` en vez de
 * DELETE, para no dejar huérfanas las respuestas (mismo criterio que
 * `eliminarComentario`, src/actions/comentarios/eliminar.ts). El trigger
 * `comunidad_posts_transiciones_permitidas` (083_comunidad.sql) exige que
 * `titulo`/`contenido` solo se vacíen, nunca se reescriban — por eso se
 * vacían acá mismo, en el mismo UPDATE que marca `eliminado`.
 *
 * Si quien borra es un administrador moderando la publicación de otra
 * persona, el texto se copia antes a `comunidad_moderacion` (RLS solo-admin)
 * para no perder la evidencia de una publicación abusiva.
 */
export async function eliminarPostComunidad(postId: string, ruta: string): Promise<EliminarComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: post, error: errorLectura } = await supabase
    .from("comunidad_posts")
    .select("id_usuario, titulo, contenido, eliminado")
    .eq("id", postId)
    .maybeSingle();

  if (errorLectura) return { error: "No pudimos eliminar la publicación." };
  if (!post) return { error: "La publicación ya no existe." };
  if (post.eliminado) return { success: true };

  const esAutor = post.id_usuario === user.id;
  let esAdmin = false;
  if (!esAutor) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
    esAdmin = perfil?.rol === "ADMINISTRADOR";
  }
  if (!esAutor && !esAdmin) return { error: "No tienes permiso para eliminar esta publicación." };

  if (esAdmin) {
    const { error: errorModeracion } = await supabase.from("comunidad_moderacion").insert({
      id_post: postId,
      contenido_original: `${post.titulo}\n\n${post.contenido}`,
      id_eliminado_por: user.id,
    });
    if (errorModeracion) return { error: "No pudimos eliminar la publicación." };
  }

  const { error } = await supabase
    .from("comunidad_posts")
    .update({ eliminado: true, titulo: "", contenido: "" })
    .eq("id", postId);

  if (error) return { error: "No pudimos eliminar la publicación." };

  await eliminarAdjuntosComunidad(supabase, { idPost: postId });

  // Solo cuando es moderación (admin borrando la publicación de otra
  // persona), no cuando el propio autor borra la suya — así queda visible
  // en /admin/bitacora, igual que fijar/desfijar (src/actions/comunidad/fijar.ts).
  // El texto completo removido sigue viviendo aparte en `comunidad_moderacion`
  // (RLS solo-admin); acá solo un resumen corto para la bitácora.
  if (esAdmin) {
    await registrarBitacora(supabase, {
      idAdmin: user.id,
      accion: "Eliminó una publicación de Comunidad (moderación)",
      entidadAfectada: "comunidad_posts",
      idEntidadAfectada: postId,
      detalles: post.titulo,
    });
  }

  revalidatePath(ruta);
  return { success: true };
}

/** Igual que `eliminarPostComunidad`, para una respuesta (sin `titulo`). */
export async function eliminarRespuestaComunidad(
  respuestaId: string,
  ruta: string,
): Promise<EliminarComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: respuesta, error: errorLectura } = await supabase
    .from("comunidad_respuestas")
    .select("id_usuario, id_post, contenido, eliminado")
    .eq("id", respuestaId)
    .maybeSingle();

  if (errorLectura) return { error: "No pudimos eliminar la respuesta." };
  if (!respuesta) return { error: "La respuesta ya no existe." };
  if (respuesta.eliminado) return { success: true };

  const esAutor = respuesta.id_usuario === user.id;
  let esAdmin = false;
  if (!esAutor) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
    esAdmin = perfil?.rol === "ADMINISTRADOR";
  }
  if (!esAutor && !esAdmin) return { error: "No tienes permiso para eliminar esta respuesta." };

  if (esAdmin) {
    const { error: errorModeracion } = await supabase.from("comunidad_moderacion").insert({
      id_respuesta: respuestaId,
      contenido_original: respuesta.contenido,
      id_eliminado_por: user.id,
    });
    if (errorModeracion) return { error: "No pudimos eliminar la respuesta." };
  }

  const { error } = await supabase
    .from("comunidad_respuestas")
    .update({ eliminado: true, contenido: "" })
    .eq("id", respuestaId);

  if (error) return { error: "No pudimos eliminar la respuesta." };

  await eliminarAdjuntosComunidad(supabase, { idRespuesta: respuestaId });

  // Idem que en eliminarPostComunidad: se usa el id del POST (no el de la
  // respuesta) como entidad afectada para que la bitácora pueda enlazar
  // directo al hilo — una respuesta suelta no tiene pantalla propia.
  if (esAdmin) {
    await registrarBitacora(supabase, {
      idAdmin: user.id,
      accion: "Eliminó una respuesta de Comunidad (moderación)",
      entidadAfectada: "comunidad_posts",
      idEntidadAfectada: respuesta.id_post,
      detalles: respuesta.contenido.slice(0, 140),
    });
  }

  revalidatePath(ruta);
  return { success: true };
}
