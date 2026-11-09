import "server-only";
import type { AuthError } from "@supabase/supabase-js";
// Llave maestra: confirmar la contraseña actual sin pasar por el captcha de Supabase (fase 4) y sin tocar la sesión de quien la cambia.
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Comprueba la contraseña actual de una cuenta (cambiar contraseña,
 * eliminar la cuenta) con un cliente de llave maestra NUEVO, solo para esto.
 *
 * Por qué no con el cliente de la sesión, como antes:
 *   1. Captcha (fase 4): con el CAPTCHA de Supabase encendido, toda llamada
 *      a /token con contraseña exige un token de Turnstile, salvo las que
 *      llevan credenciales de administrador. La persona ya pasó Turnstile
 *      al entrar; pedírselo otra vez dentro del perfil es fricción sin
 *      ganancia: el límite de 5 intentos cada 15 minutos
 *      (`comprobarLimiteLogin`) sigue protegiendo la contraseña.
 *   2. La sesión: `signInWithPassword` en el cliente de la sesión la
 *      REEMPLAZABA por una nueva de nivel aal1, así que un administrador
 *      perdía su verificación en dos pasos al cambiar la contraseña.
 *
 * El cliente es nuevo en cada llamada (nunca el mismo que hace las RPC de
 * administrador): después de `signInWithPassword` un cliente manda el token
 * de ESA cuenta, y las RPC de llave maestra dejarían de serlo. La sesión de
 * prueba se cierra enseguida.
 */
export async function comprobarPasswordActual(
  correo: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: AuthError }> {
  const cliente = createAdminClient();
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password });
  if (error) return { ok: false, error };

  // Cierra la sesión de prueba (revoca su token de renovación). Si falla,
  // vence sola; no es motivo para rechazar una contraseña correcta.
  try {
    await cliente.auth.signOut({ scope: "local" });
  } catch {
    // Se ignora a propósito.
  }
  return { ok: true };
}
