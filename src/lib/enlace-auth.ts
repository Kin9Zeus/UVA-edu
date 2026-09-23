/**
 * Códigos de Supabase Auth que significan "el enlace del correo ya no sirve
 * en este navegador", no "Supabase falló": el usuario lo abrió en otro
 * navegador o dispositivo (el code verifier PKCE vive en la cookie del
 * navegador que pidió el correo), ya lo había usado, o venció. La respuesta
 * correcta es la que ya dan los tres canjes —`/login?error=enlace_invalido`,
 * "Pide uno nuevo"—; lo único que cambia es que se registra como warning y no
 * como error (UVA-EDU-2X en Sentry: un enlace de recuperación abierto sin la
 * cookie salía como error de producción).
 *
 * Nombres en node_modules/@supabase/auth-js/src/lib/error-codes.ts y
 * errors.ts (`AuthPKCECodeVerifierMissingError`).
 */
const CODIGOS_ENLACE_VENCIDO_O_AJENO = new Set([
  "pkce_code_verifier_not_found",
  "bad_code_verifier",
  "flow_state_not_found",
  "flow_state_expired",
  "otp_expired",
]);

export function esEnlaceVencidoOAjeno(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const { code } = error as { code: unknown };
  return typeof code === "string" && CODIGOS_ENLACE_VENCIDO_O_AJENO.has(code);
}

/** Nivel con el que registrar el fallo de un canje de enlace. */
export function nivelFalloEnlace(error: unknown): "error" | "warning" {
  return esEnlaceVencidoOAjeno(error) ? "warning" : "error";
}
