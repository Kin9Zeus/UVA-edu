import { logError } from "@/lib/log";

/**
 * Para los datos SECUNDARIOS de una pantalla (el nombre de un autor, los
 * conteos de reacciones, una miniatura): si la consulta falla, la pantalla
 * sigue con un valor de reemplazo explícito ("Usuario", 0, la portada), pero el
 * fallo queda registrado en vez de pasar en silencio.
 *
 * Es la contraparte de `lanzarSiFalla` (errores.ts), que es para lo que SÍ es
 * el contenido de la pantalla. Regla: si mostrar el valor de reemplazo hace
 * creer algo falso sobre el contenido principal, se lanza; si solo lo deja
 * menos rico, se registra aquí.
 *
 * Devuelve `true` si hubo error, para poder ramificar.
 */
export function registrarSiFalla(
  error: { message?: string; code?: string } | null | undefined,
  scope: string,
  mensaje: string,
  contexto?: Record<string, unknown>,
): boolean {
  if (!error) return false;
  logError(scope, mensaje, error, { area: "degradado", ...contexto });
  return true;
}
