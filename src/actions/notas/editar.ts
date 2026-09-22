"use server";

import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";
import { logError } from "@/lib/log";
import { contenidoNotaSchema, idSchema, segundoNotaSchema } from "@/lib/notas-validacion";

export type EditarNotaResultado = { error: string } | { success: true; actualizadoEn: string };

/**
 * Cambia el texto (y opcionalmente el segundo) de una nota propia. RLS
 * (`notas_leccion_update_propio`, 115) limita el UPDATE al autor con cuenta
 * activa, y el privilegio por columna impide tocar cualquier otra cosa.
 *
 * Una nota ajena o inexistente no produce error de Postgres: RLS la vuelve
 * invisible y el UPDATE afecta 0 filas. Por eso se pide la fila de vuelta
 * con `.select()` y "ninguna fila" se trata como "ya no existe".
 */
export async function editarNota(
  notaId: string,
  contenido: string,
  segundo?: number,
): Promise<EditarNotaResultado> {
  const user = await getUsuarioActual();
  if (!user) return { error: "Debes iniciar sesión." };

  const id = idSchema.safeParse(notaId);
  const texto = contenidoNotaSchema.safeParse(contenido);
  if (!id.success) return { error: "Nota inválida." };
  if (!texto.success) return { error: texto.error.issues[0]?.message ?? "Nota inválida." };

  const cambios: { contenido: string; segundo?: number } = { contenido: texto.data };
  if (segundo !== undefined) {
    const tiempo = segundoNotaSchema.safeParse(segundo);
    if (!tiempo.success) return { error: tiempo.error.issues[0]?.message ?? "Minuto inválido." };
    cambios.segundo = tiempo.data;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas_leccion")
    .update(cambios)
    .eq("id", id.data)
    .select("actualizado_en");

  if (error) {
    logError("notas:editar", "no se pudo editar la nota", error, { area: "notas", notaId });
    return { error: "No pudimos guardar los cambios. Intenta de nuevo." };
  }
  if (!data || data.length === 0) return { error: "La nota ya no existe." };

  return { success: true, actualizadoEn: data[0].actualizado_en as string };
}
