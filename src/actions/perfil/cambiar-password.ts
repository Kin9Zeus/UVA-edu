"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPasswordValid } from "@/lib/password";
import { enviarCorreoPasswordActualizada } from "@/lib/resend";
import { logError } from "@/lib/log";
import { comprobarLimiteLogin } from "@/lib/limiteIntentosLogin";
import { tienePasswordPropia } from "@/lib/auth/tienePassword";

export type CambiarPasswordState =
  | { error: string; success?: never }
  | { error?: never; success: true; otrasSesionesCerradas: boolean }
  | null;

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  // Una cuenta que entró solo con Google no tiene contraseña que verificar:
  // sin este corte, signInWithPassword fallaría y cada intento sumaría un
  // fallo al límite de login de un usuario que no hizo nada mal.
  if (!tienePasswordPropia(user)) {
    return {
      error:
        "Tu cuenta entra con Google y no tiene contraseña. Si quieres crear una, usa «¿Olvidaste tu contraseña?» en el inicio de sesión.",
    };
  }

  const admin = createAdminClient();

  // Se chequea el bloqueo ANTES de gastar la llamada a signInWithPassword,
  // mismo criterio que login.ts.
  const bloqueo = await comprobarLimiteLogin(admin, user.email, "cambiarPassword");
  if (bloqueo) return { error: bloqueo };

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

  // Quien cambia la contraseña porque sospecha un robo espera que el intruso
  // quede fuera. Sin esto, una sesión robada seguía viva con la contraseña
  // nueva: un token de renovación vale hasta que se cierra la sesión, no
  // hasta que cambia la contraseña. Se cierran las DEMÁS y se deja la actual:
  // el usuario ya demostró conocer la contraseña vieja, así que echarlo a él
  // sería fricción sin motivo (a diferencia de actualizarPassword(), que sí
  // cierra la de recuperación para forzar un login limpio).
  //
  // Si el cierre falla, la contraseña YA cambió: no se deshace ni se
  // reporta como fallo. Pero tampoco se afirma que se cerraron las otras
  // sesiones (otrasSesionesCerradas), y queda registrado para Sentry.
  const { error: errorOtrasSesiones } = await supabase.auth.signOut({ scope: "others" });
  if (errorOtrasSesiones) {
    logError("cambiarPassword", "signOut(others) falló", errorOtrasSesiones, { area: "auth" });
  }

  return { success: true, otrasSesionesCerradas: !errorOtrasSesiones };
}
