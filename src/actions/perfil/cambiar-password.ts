"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPasswordValid } from "@/lib/password";
import { esPasswordFiltrada, MENSAJE_PASSWORD_FILTRADA } from "@/lib/password-filtrada";
import { enviarCorreoPasswordActualizada } from "@/lib/resend";
import { logError } from "@/lib/log";

export type CambiarPasswordState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | null;

function mensajeEspera(segundos: number): string {
  const minutos = Math.ceil(segundos / 60);
  return `Demasiados intentos. Espera ${minutos} minuto${minutos === 1 ? "" : "s"} e intenta de nuevo.`;
}

/**
 * Cambia la contraseña de un usuario YA logueado, desde "Mi perfil".
 *
 * Distinta de actualizarPassword() (src/actions/auth/actualizar-password.ts):
 * esa solo corre tras un enlace de recuperación de un solo uso, donde la
 * identidad ya quedó demostrada por correo. Acá la sesión activa por sí sola
 * no alcanza — cualquiera con esa sesión abierta (un navegador compartido,
 * por ejemplo) podría cambiar la contraseña sin conocer la anterior — así
 * que se reautentica con signInWithPassword() contra la actual antes de
 * aplicar la nueva.
 *
 * Reutiliza el mismo rate limit de intentos fallidos que /login
 * (verificar_intentos_login / registrar_login_fallido,
 * 022_rate_limit_login_y_recuperacion.sql) en vez de crear uno nuevo: es
 * exactamente la misma amenaza, adivinar una contraseña por fuerza bruta.
 */
export async function cambiarPassword(
  _prevState: CambiarPasswordState,
  formData: FormData,
): Promise<CambiarPasswordState> {
  const passwordActual = String(formData.get("password_actual") ?? "");
  const passwordNueva = String(formData.get("password_nueva") ?? "");
  const passwordNueva2 = String(formData.get("password_nueva2") ?? "");

  if (!passwordActual) {
    return { error: "Ingresa tu contraseña actual." };
  }
  if (!isPasswordValid(passwordNueva)) {
    return { error: "La contraseña nueva no cumple los requisitos." };
  }
  if (passwordNueva !== passwordNueva2) {
    return { error: "Las contraseñas nuevas no coinciden." };
  }
  if (passwordNueva === passwordActual) {
    return { error: "La contraseña nueva debe ser distinta de la actual." };
  }
  // Tercer punto donde se fija una contraseña, junto con registro.ts y
  // actualizar-password.ts. Los tres tienen que llevar el mismo chequeo: una
  // sola puerta sin él basta para que la cuenta acabe con una contraseña que
  // está en la lista de cualquier atacante.
  if (await esPasswordFiltrada(passwordNueva)) {
    return { error: MENSAJE_PASSWORD_FILTRADA };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const admin = createAdminClient();

  // Se chequea el bloqueo ANTES de gastar la llamada a signInWithPassword,
  // mismo criterio que login.ts.
  const { data: chequeo, error: errorChequeo } = await admin
    .rpc("verificar_intentos_login", { p_correo: user.email })
    .single();

  if (errorChequeo) {
    logError("cambiarPassword", "verificar_intentos_login rpc falló", errorChequeo);
  } else {
    const { permitido, segundos_espera } = chequeo as {
      permitido: boolean;
      segundos_espera: number;
    };
    if (!permitido) {
      return { error: mensajeEspera(segundos_espera) };
    }
  }

  // Reautenticación: confirma que quien está en esta sesión conoce la
  // contraseña actual antes de dejarlo ponerle una nueva.
  const { error: errorReauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: passwordActual,
  });

  if (errorReauth) {
    const { error: errorRegistro } = await admin.rpc("registrar_login_fallido", {
      p_correo: user.email,
    });
    if (errorRegistro) {
      logError("cambiarPassword", "registrar_login_fallido rpc falló", errorRegistro);
    }
    return { error: "Tu contraseña actual no es correcta." };
  }

  const { error: errorLimpieza } = await admin.rpc("limpiar_intentos_login", {
    p_correo: user.email,
  });
  if (errorLimpieza) {
    logError("cambiarPassword", "limpiar_intentos_login rpc falló", errorLimpieza);
  }

  const { error: errorUpdate } = await supabase.auth.updateUser({ password: passwordNueva });

  if (errorUpdate) {
    return { error: "No pudimos actualizar tu contraseña. Intenta de nuevo." };
  }

  // Best-effort, igual que en actualizarPassword(): un fallo del correo de
  // aviso no debe deshacer el cambio, que ya se aplicó.
  const resultadoCorreo = await enviarCorreoPasswordActualizada(user.email);
  if (!resultadoCorreo.success) {
    logError(
      "cambiarPassword",
      "enviarCorreoPasswordActualizada falló",
      new Error(resultadoCorreo.error),
      { area: "email" },
    );
  }

  // A diferencia de actualizarPassword() (que cierra la sesión de
  // recuperación a propósito, para forzar un login limpio): acá el usuario
  // ya demostró conocer la contraseña actual arriba, así que cortarle la
  // sesión sería una fricción sin ningún motivo de seguridad de por medio.
  return { success: true };
}
