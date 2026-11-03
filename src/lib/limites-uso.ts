import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";

/**
 * Límites de uso de las acciones con sesión (fase 3 del plan de blindaje).
 * El máximo y la ventana de cada acción viven en la base
 * (`private.limite_de_accion`, supabase/sql/134_limites_uso.sql), no aquí.
 *
 * Los aplica la base con un trigger en cada tabla (publicar, responder,
 * comentar, reaccionar, reportar, notas), así que valen también para quien
 * escriba directo por la API de Supabase. La app solo reconoce el error
 * (`esLimiteDeUso`). Los adjuntos se cuentan desde la acción
 * (`consumirLimite`), antes de procesar los archivos.
 */
export const ACCIONES_LIMITADAS = [
  "comunidad_publicar",
  "comunidad_responder",
  "comunidad_adjuntos",
  "comentar",
  "reaccionar",
  "reportar",
  "notas",
] as const;

export type AccionLimitada = (typeof ACCIONES_LIMITADAS)[number];

/** SQLSTATE con el que el trigger rechaza una escritura por el límite. */
export const CODIGO_LIMITE_DE_USO = "UV429";

/** true si la base rechazó la escritura por el límite de uso. */
export function esLimiteDeUso(error: { code?: string } | null | undefined): boolean {
  return error?.code === CODIGO_LIMITE_DE_USO;
}

export const MENSAJE_LIMITE_ALCANZADO = "Vas muy rápido. Espera unos minutos e inténtalo de nuevo.";

/** Los adjuntos cuentan por día: "unos minutos" no sería verdad. */
export const MENSAJE_LIMITE_ADJUNTOS = "Llegaste al máximo de archivos que puedes adjuntar hoy. Publica sin adjuntos o inténtalo mañana.";

/** Si la comprobación misma falla, se falla cerrado sin decir que fue por ir rápido. */
export const MENSAJE_LIMITE_SIN_COMPROBAR = "No pudimos procesar tu solicitud. Intenta de nuevo en un momento.";

/**
 * Gasta `cantidad` usos de `accion` para el usuario de la sesión. Devuelve
 * null si había cupo, o `{ error }` listo para devolver desde la Server
 * Action. Va con el cliente de la SESIÓN: la base toma el usuario de
 * `auth.uid()`, nunca de un id que mande la app.
 */
export async function consumirLimite(
  supabase: SupabaseClient,
  accion: AccionLimitada,
  cantidad = 1,
): Promise<{ error: string } | null> {
  const { data, error } = await supabase.rpc("consumir_limite", { p_accion: accion, p_cantidad: cantidad });

  if (error) {
    logError("limites-uso", "no se pudo comprobar el límite de uso", error, { area: "limites", accion });
    return { error: MENSAJE_LIMITE_SIN_COMPROBAR };
  }
  if (data !== true) {
    return { error: accion === "comunidad_adjuntos" ? MENSAJE_LIMITE_ADJUNTOS : MENSAJE_LIMITE_ALCANZADO };
  }
  return null;
}
