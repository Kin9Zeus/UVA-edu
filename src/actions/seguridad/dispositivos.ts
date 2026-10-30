"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { qrDeActivacion } from "@/lib/auth/qr";
import { getUsuarioActual } from "@/lib/perfil";
import { logError } from "@/lib/log";
import {
  CODIGO_INVALIDO,
  CODIGO_SEIS_DIGITOS,
  ERROR_GENERICO_CODIGO,
  limpiarCodigo,
  mensajeDeCodigo,
} from "@/lib/auth/codigoSegundoFactor";
import type { IniciarActivacionState } from "@/actions/seguridad/segundo-factor";

/**
 * Dispositivos de la verificación en dos pasos, desde Mi perfil — FASE 8.1.
 *
 * Con un solo dispositivo, perder el celular deja a un administrador fuera del
 * panel. Aquí se registra un segundo (otra app, o el gestor de contraseñas) y
 * se quita uno que ya no se use.
 *
 * Todo pasa por `requireAdmin()`, que exige sesión aal2: Supabase pide aal2
 * para añadir un factor a una cuenta que ya tiene uno y para quitar uno
 * confirmado, y sin ese nivel quien tenga solo la contraseña podría registrar
 * SU dispositivo en la cuenta de otro.
 */

const RUTA_PERFIL = "/dashboard/perfil";
const LARGO_MAXIMO_NOMBRE = 40;
const SIN_PERMISO = "No pudimos comprobar tus permisos. Intenta de nuevo.";

export type ConfirmarDispositivoState = { error: string; exito?: never } | { error?: never; exito: true } | null;
export type QuitarDispositivoResultado = { error: string } | { exito: true };

/**
 * Crea un factor SIN confirmar con el nombre que elija la persona y devuelve el
 * QR y la clave. El nombre es lo que distingue los dispositivos en la lista
 * (y Supabase no admite dos con el mismo).
 */
export async function iniciarOtroDispositivo(
  _prevState: IniciarActivacionState,
  formData: FormData,
): Promise<IniciarActivacionState> {
  // El guard va PRIMERO en toda acción de administrador: así lo exige
  // src/actions/admin/autorizacion.test.ts (sin permiso, no se toca nada).
  const admin = await requireAdmin();
  // `?? SIN_PERMISO`: TypeScript ve `error` como opcional en la unión de requireAdmin.
  if ("error" in admin) return { error: admin.error ?? SIN_PERMISO };

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre || nombre.length > LARGO_MAXIMO_NOMBRE) {
    return {
      error: `Ponle un nombre de hasta ${LARGO_MAXIMO_NOMBRE} caracteres, por ejemplo «Bóveda» o «Celular de respaldo».`,
    };
  }

  const { data: factores, error: errorFactores } = await admin.supabase.auth.mfa.listFactors();
  if (errorFactores) {
    logError("dispositivos:iniciar", "listFactors falló", errorFactores, { area: "auth" });
    return { error: "No pudimos preparar el dispositivo. Intenta de nuevo." };
  }

  // Igual que en la activación: un factor a medio registrar no protege nada,
  // y cada intento dejaría otro (Supabase limita cuántos tiene una cuenta).
  for (const factor of (factores?.all ?? []).filter((f) => f.status === "unverified")) {
    const { error } = await admin.supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) logError("dispositivos:iniciar", "unenroll de un factor sin confirmar falló", error, { area: "auth" });
  }

  const { data, error } = await admin.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: nombre });
  if (error || !data) {
    if (error?.code === "mfa_factor_name_conflict") return { error: "Ya tienes un dispositivo con ese nombre." };
    if (error?.code === "too_many_enrolled_mfa_factors") {
      return { error: "Llegaste al máximo de dispositivos. Quita uno antes de añadir otro." };
    }
    logError("dispositivos:iniciar", "enroll falló", error, { area: "auth" });
    return { error: "No pudimos preparar el dispositivo. Intenta de nuevo." };
  }

  // `getUsuarioActual` ya lo resolvió `requireAdmin` (va en cache()): no es otra consulta.
  const usuario = await getUsuarioActual();
  const { src, lado } = await qrDeActivacion({ secreto: data.totp.secret, correo: usuario?.email });
  return { factorId: data.id, qr: src, ladoQr: lado, secreto: data.totp.secret };
}

/**
 * El primer código del dispositivo nuevo lo confirma. Supabase, al confirmar
 * un factor, cierra las demás sesiones de la cuenta (la actual sigue).
 */
export async function confirmarOtroDispositivo(
  _prevState: ConfirmarDispositivoState,
  formData: FormData,
): Promise<ConfirmarDispositivoState> {
  const admin = await requireAdmin();
  // `?? SIN_PERMISO`: TypeScript ve `error` como opcional en la unión de requireAdmin.
  if ("error" in admin) return { error: admin.error ?? SIN_PERMISO };

  const factorId = String(formData.get("factorId") ?? "");
  const codigo = limpiarCodigo(formData.get("codigo"));

  if (!factorId) return { error: "Vuelve a empezar." };
  if (!CODIGO_SEIS_DIGITOS.test(codigo)) return { error: CODIGO_INVALIDO };

  const { error } = await admin.supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) {
    const mensaje = mensajeDeCodigo(error);
    if (mensaje) return { error: mensaje };
    logError("dispositivos:confirmar", "challengeAndVerify falló", error, { area: "auth" });
    return { error: ERROR_GENERICO_CODIGO };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Añadió un dispositivo de verificación en dos pasos",
    entidadAfectada: "auth.mfa_factors",
    idEntidadAfectada: factorId,
  });

  revalidatePath(RUTA_PERFIL);
  return { exito: true };
}

/**
 * Quita un dispositivo propio. Nunca el último: un administrador sin
 * dispositivos queda, en la próxima entrada, obligado a registrar uno de nuevo,
 * y entre tanto su cuenta solo tendría la contraseña. Para cambiar el único,
 * primero se añade el nuevo.
 */
export async function quitarDispositivo(factorId: string): Promise<QuitarDispositivoResultado> {
  const admin = await requireAdmin();
  // `?? SIN_PERMISO`: TypeScript ve `error` como opcional en la unión de requireAdmin.
  if ("error" in admin) return { error: admin.error ?? SIN_PERMISO };

  const { data: factores, error: errorFactores } = await admin.supabase.auth.mfa.listFactors();
  if (errorFactores) {
    logError("dispositivos:quitar", "listFactors falló", errorFactores, { area: "auth" });
    return { error: "No pudimos quitar el dispositivo. Intenta de nuevo." };
  }

  const confirmados = factores?.totp ?? [];
  // Solo factores de ESTA cuenta: `listFactors` es de la sesión, así que un id
  // ajeno simplemente no aparece aquí.
  if (!confirmados.some((f) => f.id === factorId)) return { error: "Ese dispositivo ya no está registrado." };
  if (confirmados.length <= 1) {
    return { error: "Es tu único dispositivo. Para cambiarlo, primero añade el nuevo y luego quita este." };
  }

  const { error } = await admin.supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    logError("dispositivos:quitar", "unenroll falló", error, { area: "auth" });
    return { error: "No pudimos quitar el dispositivo. Intenta de nuevo." };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Quitó un dispositivo de verificación en dos pasos",
    entidadAfectada: "auth.mfa_factors",
    idEntidadAfectada: factorId,
  });

  revalidatePath(RUTA_PERFIL);
  return { exito: true };
}
