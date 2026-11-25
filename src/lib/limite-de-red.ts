/**
 * Límite de tiempo para las llamadas del servidor a Supabase, Mux y Resend
 * (P2-14, AUDIT-2026-11-23). Sin él, una petición esperaba sin fin: con los
 * picos de 1–12 s de la instancia Nano de Supabase, las peticiones se
 * acumulaban en el servidor en vez de fallar y liberarse.
 *
 * 10 s queda por encima del `statement_timeout` de 8 s del rol
 * `authenticated`: lo normal es que la base corte primero, con un error
 * claro. Una operación que de verdad tarda más (la supresión de una cuenta,
 * 30 s en `supabase/sql/111`) pasa su propio `.abortSignal(...)`, y ese gana.
 */
export const LIMITE_RED_MS = 10_000;

/** `fetch` con límite, salvo que la llamada ya traiga su propia señal. */
export function fetchConLimite(ms = LIMITE_RED_MS): typeof fetch {
  return (entrada, opciones) =>
    fetch(entrada, opciones?.signal ? opciones : { ...opciones, signal: AbortSignal.timeout(ms) });
}
