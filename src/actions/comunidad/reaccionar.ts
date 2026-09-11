"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReaccionComunidadResultado = { error: string } | { success: true };

/**
 * Reacciona o quita la reacción a un post o una respuesta. No se usa
 * `upsert` (como `darLikeComentario`, src/actions/comentarios/like.ts):
 * la unicidad de `comunidad_reacciones` vive en dos índices PARCIALES
 * (uno por post, otro por respuesta — ver 083_comunidad.sql), y PostgREST
 * no puede inferir un índice de conflicto parcial a partir de una lista de
 * columnas. En su lugar, un INSERT liso e ignorar el choque (23505) como
 * "ya estaba reaccionado" — idempotente igual, sin depender de ON CONFLICT.
 */
async function reaccionar(
  columnaObjetivo: "id_post" | "id_respuesta",
  objetivoId: string,
  ruta: string,
): Promise<ReaccionComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("comunidad_reacciones")
    .insert({ id_usuario: user.id, [columnaObjetivo]: objetivoId });

  if (error && error.code !== "23505") return { error: "No pudimos guardar tu reacción." };

  revalidatePath(ruta);
  return { success: true };
}

async function quitarReaccion(
  columnaObjetivo: "id_post" | "id_respuesta",
  objetivoId: string,
  ruta: string,
): Promise<ReaccionComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("comunidad_reacciones")
    .delete()
    .eq("id_usuario", user.id)
    .eq(columnaObjetivo, objetivoId);

  if (error) return { error: "No pudimos quitar tu reacción." };

  revalidatePath(ruta);
  return { success: true };
}

// Next.js exige que todo export de un archivo "use server" sea una función
// async (el compilador de Server Actions las envuelve como referencias
// remotas) — por eso estas cuatro no son un simple re-export de
// `reaccionar`/`quitarReaccion`, aunque no hagan nada más que reenviar los
// argumentos con la columna ya fijada.
export async function reaccionarPostComunidad(postId: string, ruta: string) {
  return reaccionar("id_post", postId, ruta);
}

export async function quitarReaccionPostComunidad(postId: string, ruta: string) {
  return quitarReaccion("id_post", postId, ruta);
}

export async function reaccionarRespuestaComunidad(respuestaId: string, ruta: string) {
  return reaccionar("id_respuesta", respuestaId, ruta);
}

export async function quitarReaccionRespuestaComunidad(respuestaId: string, ruta: string) {
  return quitarReaccion("id_respuesta", respuestaId, ruta);
}
