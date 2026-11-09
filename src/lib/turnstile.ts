/**
 * Cloudflare Turnstile (fase 4 del plan de blindaje): el chequeo anti-bots
 * de los formularios que usa alguien SIN sesión (registro, la contraseña al
 * entrar, recuperar contraseña, reenviar la verificación).
 *
 * Quién valida el token: Supabase Auth, no la app. Con "CAPTCHA" activado en
 * Supabase (Authentication → Bot and Abuse Protection), cada llamada a
 * /signup, /token (contraseña), /recover y /resend exige `captchaToken`
 * (fuente: supabase/auth, internal/api/api.go, `verifyCaptcha`). La llave
 * SECRETA de Turnstile vive solo en Supabase: la app nunca la tiene, así
 * que robar las variables de Railway no la entrega.
 *
 * Orden seguro de encendido (docs/ops/cloudflare.md, fase 4): primero la app
 * con la llave pública (el recuadro aparece y manda el token, que Supabase
 * todavía ignora), después el CAPTCHA en Supabase. Al revés, nadie entra.
 *
 * Las llamadas con la llave maestra no pasan por el captcha (Supabase lo
 * salta con credenciales de administrador): por eso confirmar la contraseña
 * en el perfil no lleva recuadro (`lib/auth/passwordActual.ts`).
 */

/** El campo que Turnstile agrega solo dentro del <form>. */
export const CAMPO_TURNSTILE = "cf-turnstile-response";

/** Llave pública. Sin ella no se muestra el recuadro (local, CI sin llave). */
export function llavePublicaTurnstile(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

/** El token del formulario, o `undefined` si no vino (sin recuadro). */
export function tokenTurnstile(formData: FormData): string | undefined {
  const valor = formData.get(CAMPO_TURNSTILE);
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

/**
 * Supabase rechazó por el captcha (`captcha_failed`): token vacío, vencido,
 * ya usado o de un bot. No es una contraseña equivocada: no se cuenta como
 * intento fallido ni se registra como `login_fallido`.
 */
export function esFalloCaptcha(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "captcha_failed" || /captcha/i.test(error.message ?? "");
}

export const MENSAJE_CAPTCHA =
  "No pudimos comprobar que eres una persona. Espera a que se marque el recuadro de verificación e inténtalo de nuevo.";
