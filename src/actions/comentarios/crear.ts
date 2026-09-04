"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CrearComentarioResultado = { error: string } | { success: true; id: string };

const contenidoSchema = z
  .string()
  .trim()
  .min(1, "Escribe algo antes de comentar.")
  .max(2000, "El comentario es demasiado largo.");

/**
 * Crea un comentario raíz o una respuesta (`idComentarioPadre`) en el hilo
 * de una lección.
 *
 * `id_usuario` sale de la sesión, nunca del cliente — la policy
 * `comentarios_insert_propio` (052_comentarios.sql) ya lo exige con
 * `auth.uid() = id_usuario`, esto es la misma regla aplicada antes de
 * intentar el INSERT, para devolver un mensaje claro en vez de un error
 * crudo de RLS.
 *
 * Una respuesta solo puede colgar de un comentario raíz (un solo nivel de
 * anidación, decisión de producto) — se valida acá porque el esquema no
 * puede expresar "el padre de mi padre debe ser null".
 */
export async function crearComentario(
  leccionId: string,
  contenido: string,
  idComentarioPadre: string | null,
  /** Ruta pública de la clase (`/cursos/<slug-curso>/<slug-lección>`), para
   * revalidar exactamente el path que Next.js cacheó — no el UUID interno. */
  ruta: string,
): Promise<CrearComentarioResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para comentar." };

  const parseo = contenidoSchema.safeParse(contenido);
  if (!parseo.success) return { error: parseo.error.issues[0]?.message ?? "Comentario inválido." };

  if (idComentarioPadre) {
    const { data: padre } = await supabase
      .from("comentarios")
      .select("id_comentario_padre")
      .eq("id", idComentarioPadre)
      .maybeSingle();
    if (!padre) return { error: "El comentario al que respondes ya no existe." };
    if (padre.id_comentario_padre) return { error: "No se puede responder a una respuesta." };
  }

  const { data, error } = await supabase
    .from("comentarios")
    .insert({
      id_leccion: leccionId,
      id_usuario: user.id,
      id_comentario_padre: idComentarioPadre,
      contenido: parseo.data,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos publicar tu comentario." };

  revalidatePath(ruta);
  return { success: true, id: data.id };
}
