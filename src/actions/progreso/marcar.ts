"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MarcarLeccionState = { error: string } | { ok: true; completado: boolean };

/**
 * Marca o desmarca una clase como completada desde el reproductor. El mockup
 * expone las dos direcciones ("Marcar clase N como completada" /
 * "Clase N completada ✓"), así que el estado se recibe explícito en vez de
 * derivarse: el botón ya sabe en qué estado está.
 *
 * RLS: la política de `progreso` acota por `id_usuario = auth.uid()`, así que
 * el upsert se hace con el cliente de sesión, nunca con service role.
 */
export async function marcarLeccion(
  leccionId: string,
  completado: boolean,
): Promise<MarcarLeccionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const { error } = await supabase
    .from("progreso")
    .upsert(
      { id_usuario: user.id, id_leccion: leccionId, completado },
      { onConflict: "id_usuario,id_leccion" },
    );

  if (error) {
    return { error: "No pudimos guardar tu progreso. Intenta de nuevo." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, completado };
}
