"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";
import { logError } from "@/lib/log";

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
 * `comentarios_insert_propio` (última versión: 125) ya lo exige con
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
  const user = await getUsuarioActual();
  if (!user) return { error: "Debes iniciar sesión para comentar." };

  const parseo = contenidoSchema.safeParse(contenido);
  if (!parseo.success) return { error: parseo.error.issues[0]?.message ?? "Comentario inválido." };

  if (idComentarioPadre) {
    const { data: padre, error: errorPadre } = await supabase
      .from("comentarios")
      .select("id_comentario_padre, eliminado")
      .eq("id", idComentarioPadre)
      .maybeSingle();
    // Un fallo no es "el comentario al que respondes ya no existe".
    if (errorPadre) return { error: "No pudimos publicar tu respuesta. Intenta de nuevo." };
    if (!padre || padre.eliminado) return { error: "El comentario al que respondes ya no existe." };
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

  if (error || !data) {
    // 42501: la policy de INSERT lo rechazó (sin acceso vigente a la clase).
    // No es un fallo del sistema: decir "no pudimos" haría reintentar en vano.
    if (error?.code === "42501") {
      return { error: "No tienes acceso para comentar en esta clase." };
    }
    // Nunca el contenido en el log: es texto del usuario.
    logError("comentarios:crear", "no se pudo crear el comentario", error, { area: "comentarios", leccionId });
    return { error: "No pudimos publicar tu comentario. Intenta de nuevo." };
  }

  revalidatePath(ruta);
  return { success: true, id: data.id };
}
