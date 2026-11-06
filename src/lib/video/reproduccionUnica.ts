import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarSiFalla } from "@/lib/supabase/registrar";

/**
 * Un solo video a la vez por cuenta de estudiante (functional-spec, Flujo 05).
 * La regla vive en la base (supabase/sql/136_reproduccion_unica.sql): gana el
 * último dispositivo que reclama, y los administradores quedan fuera.
 *
 * Las dos funciones fallan ABIERTO: un error de la base no prueba que haya
 * otro dispositivo, y cortarle el video a alguien por un fallo nuestro es
 * peor que dejarlo ver. El fallo se registra.
 */

export const MENSAJE_OTRO_DISPOSITIVO = "Tu cuenta se está reproduciendo en otro dispositivo.";

/** Token nuevo para este reproductor, o null (administrador, o la base falló). */
export async function reclamarReproduccion(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("reclamar_reproduccion");
  if (registrarSiFalla(error, "video:reproduccionUnica", "no se pudo reclamar la reproducción")) return null;
  return typeof data === "string" ? data : null;
}

/** ¿Este reproductor sigue siendo el de la cuenta? Sin token, no hay nada que comprobar. */
export async function reproduccionVigente(supabase: SupabaseClient, sesion: string | null): Promise<boolean> {
  if (!sesion) return true;
  const { data, error } = await supabase.rpc("reproduccion_vigente", { p_sesion: sesion });
  if (registrarSiFalla(error, "video:reproduccionUnica", "no se pudo comprobar la reproducción")) return true;
  return data !== false;
}
