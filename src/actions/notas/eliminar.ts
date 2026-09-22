"use server";

import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";
import { logError } from "@/lib/log";
import { idSchema } from "@/lib/notas-validacion";

export type EliminarNotaResultado = { error: string } | { success: true };

/**
 * Borrado físico (DELETE): a diferencia de `comentarios`, una nota no tiene
 * hilo que conservar. RLS (`notas_leccion_delete_propio`, 115) limita al
 * autor y NO exige acceso vigente ni cuenta activa: borrar los datos
 * propios nunca se bloquea.
 *
 * Idempotente: si la nota ya no existe (o es ajena, que RLS vuelve
 * invisible) no hay nada que borrar, y el resultado es el mismo que pidió
 * quien llama.
 */
export async function eliminarNota(notaId: string): Promise<EliminarNotaResultado> {
  const user = await getUsuarioActual();
  if (!user) return { error: "Debes iniciar sesión." };

  const id = idSchema.safeParse(notaId);
  if (!id.success) return { error: "Nota inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("notas_leccion").delete().eq("id", id.data);

  if (error) {
    logError("notas:eliminar", "no se pudo eliminar la nota", error, { area: "notas", notaId });
    return { error: "No pudimos eliminar la nota. Intenta de nuevo." };
  }
  return { success: true };
}
