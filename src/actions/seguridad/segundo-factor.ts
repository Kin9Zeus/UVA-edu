"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";
import { logError } from "@/lib/log";
import { qrDeActivacion } from "@/lib/auth/qr";

/**
 * Segundo factor (app de autenticación, TOTP) — FASE 8.1 del plan de
 * blindaje. Tres acciones, una por pantalla y paso:
 *
 *   iniciarActivacion    crea el factor y devuelve el QR y la clave de respaldo
 *   confirmarActivacion  el administrador escribe el primer código: el factor
 *                        queda confirmado y la sesión pasa a aal2
 *   verificarSegundoFactor  al entrar: escribe el código y la sesión pasa a aal2
 *
 * Todas dejan el nivel de la sesión en manos de Supabase: no se marca nada a
 * mano. Cuando el código es correcto, Supabase entrega un token nuevo con
 * `aal: "aal2"` y el cliente de servidor lo guarda en las cookies.
 */

/** Destino si la pantalla no recibe `redirect`: esto es la puerta del panel. */
const DESTINO_POR_DEFECTO = "/admin";

export type IniciarActivacionState =
  | { error: string; factorId?: never; qr?: never; ladoQr?: never; secreto?: never }
  | { error?: never; factorId: string; qr: string; ladoQr: number; secreto: string }
  | null;

export type VerificarCodigoState = { error: string } | null;

const SESION_EXPIRADA = "Tu sesión expiró. Vuelve a iniciar sesión.";

/** Solo dígitos: las apps los muestran como «123 456» y quien copia pega el espacio. */
function limpiarCodigo(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.replace(/\s+/g, "") : "";
}

const CODIGO_SEIS_DIGITOS = /^\d{6}$/;
const CODIGO_INVALIDO = "Escribe los 6 dígitos que muestra tu app de autenticación.";

type ErrorDeAuth = { code?: string; status?: number; message?: string } | null | undefined;

/**
 * Qué decirle a la persona cuando Supabase rechaza el código. El texto del
 * error de Supabase viene en inglés y habla de «TOTP»: no sirve para mostrarlo.
 * Devuelve `null` si el fallo no es del código (red, servidor...), que quien
 * llama debe registrar y reportar como fallo genérico.
 */
function mensajeDeCodigo(error: ErrorDeAuth): string | null {
  if (!error) return null;
  if (error.code === "mfa_verification_failed") {
    return "El código no es correcto. Revisa que la hora de tu celular sea automática y vuelve a intentarlo.";
  }
  if (error.code === "mfa_challenge_expired") {
    return "El código tardó demasiado. Escribe el que muestra tu app ahora.";
  }
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  return null;
}

const ERROR_GENERICO = "No pudimos verificar el código. Intenta de nuevo.";

/**
 * Paso 1 de la activación: crea un factor SIN confirmar y devuelve lo que la
 * persona necesita para añadirlo a su app (QR y clave escrita).
 *
 * Los factores a medio registrar de intentos anteriores se borran antes: cada
 * visita crearía uno nuevo y Supabase limita cuántos puede tener una cuenta.
 * Un factor sin confirmar no protege nada, así que borrarlo no pierde nada.
 */
export async function iniciarActivacion(): Promise<IniciarActivacionState> {
  const supabase = await createClient();
  const user = await getUsuarioActual();
  if (!user) return { error: SESION_EXPIRADA };

  const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors();
  if (errorFactores) {
    logError("segundoFactor:iniciar", "listFactors falló", errorFactores, { area: "auth" });
    return { error: "No pudimos preparar la activación. Intenta de nuevo." };
  }

  if ((factores?.totp ?? []).length > 0) {
    return { error: "Ya registraste una app de autenticación. Inicia sesión y escribe tu código." };
  }

  for (const factor of (factores?.all ?? []).filter((f) => f.status === "unverified")) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) logError("segundoFactor:iniciar", "unenroll de un factor sin confirmar falló", error, { area: "auth" });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) {
    logError("segundoFactor:iniciar", "enroll falló", error, { area: "auth" });
    return { error: "No pudimos preparar la activación. Intenta de nuevo." };
  }

  // El QR se genera aquí con una dirección corta y no se usa el `qr_code` de
  // Supabase: ver el comentario de lib/auth/qr.ts (no se pintaba, no se leía).
  const { src, lado } = await qrDeActivacion({ secreto: data.totp.secret, correo: user.email });
  return { factorId: data.id, qr: src, ladoQr: lado, secreto: data.totp.secret };
}

/**
 * Paso 2 de la activación: el primer código confirma el factor. Supabase, al
 * confirmarlo, cierra las demás sesiones de la cuenta y deja la actual en aal2.
 */
export async function confirmarActivacion(
  _prevState: VerificarCodigoState,
  formData: FormData,
): Promise<VerificarCodigoState> {
  const factorId = String(formData.get("factorId") ?? "");
  const codigo = limpiarCodigo(formData.get("codigo"));
  const destino = destinoInternoSeguro(formData.get("redirect"), DESTINO_POR_DEFECTO);

  if (!factorId) return { error: "Vuelve a empezar la activación." };
  if (!CODIGO_SEIS_DIGITOS.test(codigo)) return { error: CODIGO_INVALIDO };

  const supabase = await createClient();
  const user = await getUsuarioActual();
  if (!user) return { error: SESION_EXPIRADA };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) {
    const mensaje = mensajeDeCodigo(error);
    if (mensaje) return { error: mensaje };
    logError("segundoFactor:confirmar", "challengeAndVerify falló", error, { area: "auth" });
    return { error: ERROR_GENERICO };
  }

  redirect(destino);
}

/**
 * Al entrar: la persona ya tiene un factor confirmado y escribe su código.
 *
 * Con dos dispositivos registrados (lo que recomienda el plan) el código puede
 * ser de cualquiera de los dos, y Supabase verifica contra un factor concreto,
 * así que se prueban en orden y gana el primero que acierte. Un código malo
 * cuenta como intento contra el límite de Supabase en cada factor: es el precio
 * de no preguntar «¿con cuál dispositivo?».
 */
export async function verificarSegundoFactor(
  _prevState: VerificarCodigoState,
  formData: FormData,
): Promise<VerificarCodigoState> {
  const codigo = limpiarCodigo(formData.get("codigo"));
  const destino = destinoInternoSeguro(formData.get("redirect"), DESTINO_POR_DEFECTO);

  if (!CODIGO_SEIS_DIGITOS.test(codigo)) return { error: CODIGO_INVALIDO };

  const supabase = await createClient();
  const user = await getUsuarioActual();
  if (!user) return { error: SESION_EXPIRADA };

  const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors();
  if (errorFactores) {
    logError("segundoFactor:verificar", "listFactors falló", errorFactores, { area: "auth" });
    return { error: ERROR_GENERICO };
  }

  const confirmados = factores?.totp ?? [];
  if (confirmados.length === 0) {
    return { error: "Aún no registraste una app de autenticación." };
  }

  let ultimoMensaje = ERROR_GENERICO;
  for (const factor of confirmados) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
    if (!error) redirect(destino);

    const mensaje = mensajeDeCodigo(error);
    if (!mensaje) {
      logError("segundoFactor:verificar", "challengeAndVerify falló", error, { area: "auth" });
      return { error: ERROR_GENERICO };
    }
    // Pasar al siguiente dispositivo solo tiene sentido si el código fue
    // rechazado; con límite de intentos, seguir insistiendo lo empeora.
    if (error.code === "over_request_rate_limit" || error.status === 429) return { error: mensaje };
    ultimoMensaje = mensaje;
  }

  return { error: ultimoMensaje };
}
