/**
 * Lo común a todas las acciones que reciben un código de la app de
 * autenticación — FASE 8.1. Vive fuera de los archivos de acciones porque un
 * archivo `"use server"` solo puede exportar funciones asíncronas.
 */

/** Solo dígitos: las apps los muestran como «123 456» y quien copia pega el espacio. */
export function limpiarCodigo(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.replace(/\s+/g, "") : "";
}

export const CODIGO_SEIS_DIGITOS = /^\d{6}$/;

export const CODIGO_INVALIDO = "Escribe los 6 dígitos que muestra tu app de autenticación.";

export const ERROR_GENERICO_CODIGO = "No pudimos verificar el código. Intenta de nuevo.";

type ErrorDeAuth = { code?: string; status?: number; message?: string } | null | undefined;

/** ¿Supabase cortó por exceso de intentos? Ahí no se debe seguir insistiendo. */
export function esLimiteDeIntentos(error: ErrorDeAuth): boolean {
  return error?.code === "over_request_rate_limit" || error?.status === 429;
}

/**
 * Qué decirle a la persona cuando Supabase rechaza el código. El texto del
 * error de Supabase viene en inglés y habla de «TOTP»: no sirve para mostrarlo.
 * Devuelve `null` si el fallo no es del código (red, servidor...), que quien
 * llama debe registrar y reportar como fallo genérico.
 */
export function mensajeDeCodigo(error: ErrorDeAuth): string | null {
  if (!error) return null;
  if (error.code === "mfa_verification_failed") {
    return "El código no es correcto. Revisa que la hora de tu celular sea automática y vuelve a intentarlo.";
  }
  if (error.code === "mfa_challenge_expired") {
    return "El código tardó demasiado. Escribe el que muestra tu app ahora.";
  }
  if (esLimiteDeIntentos(error)) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  return null;
}
