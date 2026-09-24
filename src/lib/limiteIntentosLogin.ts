import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";

/**
 * Límite de intentos de contraseña (022_rate_limit_login_y_recuperacion.sql:
 * 5 intentos fallidos por correo en 15 minutos), comprobado ANTES de gastar
 * la llamada a `signInWithPassword`. Lo comparten los tres sitios que
 * verifican una contraseña: login, cambiar contraseña y eliminar la cuenta.
 *
 * Devuelve el mensaje de error para el usuario, o `null` si puede seguir.
 *
 * FALLA CERRADO (P2-6, AUDIT-2026-09-22.md, decisión del propietario): si la
 * consulta del límite falla, NO se deja pasar. Antes se registraba y se
 * seguía, así que con la función caída el freno contra fuerza bruta
 * desaparecía justo cuando nadie lo estaba mirando. El costo es que, durante
 * esa caída, nadie puede verificar su contraseña.
 *
 * `servicio` es el cliente de Service Role: la función no está expuesta a
 * `anon` (se consulta antes de que haya sesión).
 */
export async function comprobarLimiteLogin(
  servicio: SupabaseClient,
  correo: string,
  scope: string,
): Promise<string | null> {
  const { data, error } = await servicio.rpc("verificar_intentos_login", { p_correo: correo }).single();

  if (error || !data) {
    logError(scope, "verificar_intentos_login rpc falló; se bloquea el intento", error, { area: "auth" });
    return "No pudimos verificar tu acceso en este momento. Intenta de nuevo en unos minutos.";
  }

  const { permitido, segundos_espera } = data as { permitido: boolean; segundos_espera: number };
  return permitido ? null : mensajeEspera(segundos_espera);
}

function mensajeEspera(segundos: number): string {
  const minutos = Math.ceil(segundos / 60);
  return `Demasiados intentos. Espera ${minutos} minuto${minutos === 1 ? "" : "s"} e intenta de nuevo.`;
}
