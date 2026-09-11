"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prepararAdjuntosNuevos, subirAdjuntosProcesados, borrarAdjuntoComunidad } from "@/lib/comunidad-adjuntos";
import { MAX_ADJUNTOS_COMUNIDAD } from "@/lib/comunidad-tipos";
import { tituloSchema, contenidoPostSchema } from "@/lib/comunidad-validacion";

export type EditarPostComunidadResultado = { error: string } | { success: true };

/** Une todos los ids que aparecen como marcador `[[adjunto:ID]]` en el
 * texto ya final (existentes sin tocar + nuevos ya sustituidos por
 * prepararAdjuntosNuevos) — para saber cuáles de los adjuntos que el post
 * tenía ANTES de esta edición siguen apareciendo y cuáles el usuario quitó
 * del texto. */
function idsDeAdjuntosEnTexto(contenido: string): Set<string> {
  return new Set([...contenido.matchAll(/\[\[adjunto:([^\]]+)\]\]/g)].map((m) => m[1]));
}

/**
 * Edita el título/contenido de una publicación propia — solo el autor,
 * solo mientras no esté eliminada (087_comunidad_editar_publicacion.sql
 * es lo que ahora permite este UPDATE a nivel de trigger; RLS y los grants
 * de columna ya lo dejaban desde 083). No hay edición de categoría a
 * propósito: la categoría la decide la pestaña donde se publicó
 * (ComunidadComposer) y cambiarla después mezclaría el filtro con el que
 * llegaron las respuestas ya existentes.
 *
 * Adjuntos: los marcadores de imágenes/archivos que ya tenía la
 * publicación y el usuario no borró del texto se conservan tal cual (sus
 * ids ya son reales, `prepararAdjuntosNuevos` no los toca); los nuevos que
 * haya agregado en esta edición pasan por el mismo camino que al crear un
 * post. Los que el usuario borró del texto (su chip ya no aparece) se
 * eliminan de verdad acá — Storage y fila — comparando el conjunto de ids
 * de ANTES contra el de la publicación ya guardada.
 */
export async function editarPostComunidad(
  postId: string,
  titulo: string,
  contenido: string,
  ruta: string,
  adjuntosFormData: FormData = new FormData(),
): Promise<EditarPostComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: post } = await supabase
    .from("comunidad_posts")
    .select("id_usuario, eliminado")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.eliminado) return { error: "La publicación ya no existe." };
  if (post.id_usuario !== user.id) return { error: "No tienes permiso para editar esta publicación." };

  const parseoTitulo = tituloSchema.safeParse(titulo);
  if (!parseoTitulo.success) return { error: parseoTitulo.error.issues[0]?.message ?? "Título inválido." };

  const parseoContenido = contenidoPostSchema.safeParse(contenido);
  if (!parseoContenido.success) {
    return { error: parseoContenido.error.issues[0]?.message ?? "Contenido inválido." };
  }

  if (adjuntosFormData.getAll("token").length > MAX_ADJUNTOS_COMUNIDAD) {
    return { error: `No puedes adjuntar más de ${MAX_ADJUNTOS_COMUNIDAD} archivos por publicación.` };
  }

  const { data: adjuntosPrevios } = await supabase
    .from("comunidad_adjuntos")
    .select("id, ruta_storage")
    .eq("id_post", postId);

  const resultadoAdjuntos = await prepararAdjuntosNuevos(parseoContenido.data, adjuntosFormData);
  if ("error" in resultadoAdjuntos) return { error: resultadoAdjuntos.error };

  const idsQueQuedan = idsDeAdjuntosEnTexto(resultadoAdjuntos.contenido);

  const { error } = await supabase
    .from("comunidad_posts")
    .update({ titulo: parseoTitulo.data, contenido: resultadoAdjuntos.contenido })
    .eq("id", postId);

  if (error) return { error: "No pudimos guardar los cambios." };

  await subirAdjuntosProcesados(supabase, resultadoAdjuntos.procesados, { idPost: postId, idUsuario: user.id });

  for (const previo of adjuntosPrevios ?? []) {
    if (!idsQueQuedan.has(previo.id)) {
      await borrarAdjuntoComunidad(supabase, previo.id, previo.ruta_storage);
    }
  }

  revalidatePath(ruta);
  return { success: true };
}
