/**
 * Consentimiento de cookies de analítica (GA4 y Clarity).
 *
 * Una sola decisión para toda la analítica: «Aceptar» o «Rechazar», con el
 * mismo peso (decisión del 17-nov-2026). Se guarda en el navegador
 * (localStorage), no en una cookie: así guardarla no es, a su vez, una cookie
 * más que declarar.
 *
 * `VERSION_CONSENTIMIENTO` se sube cuando cambie lo que se pide (otra
 * herramienta, otra finalidad o un texto legal nuevo): una decisión guardada
 * con una versión anterior deja de valer y el aviso vuelve a salir.
 *
 * Funciones puras: el componente (`components/analitica/Analitica.tsx`) es
 * quien lee y escribe el almacenamiento.
 */

export const CLAVE_CONSENTIMIENTO = "uva-consentimiento-analitica";
export const VERSION_CONSENTIMIENTO = 1;

/** Evento del navegador para volver a abrir el aviso desde el pie. */
export const EVENTO_ABRIR_AVISO_COOKIES = "uva:abrir-aviso-cookies";

export type DecisionConsentimiento = "aceptada" | "rechazada";

type Guardado = { decision: DecisionConsentimiento; version: number; fecha: string };

/** La decisión vigente, o null si no hay (nunca decidió, versión vieja o dato roto). */
export function leerConsentimiento(guardado: string | null): DecisionConsentimiento | null {
  if (!guardado) return null;
  try {
    const dato = JSON.parse(guardado) as Partial<Guardado> | null;
    if (!dato || dato.version !== VERSION_CONSENTIMIENTO) return null;
    return dato.decision === "aceptada" || dato.decision === "rechazada" ? dato.decision : null;
  } catch {
    return null;
  }
}

export function serializarConsentimiento(decision: DecisionConsentimiento, fecha: Date): string {
  const guardado: Guardado = { decision, version: VERSION_CONSENTIMIENTO, fecha: fecha.toISOString() };
  return JSON.stringify(guardado);
}

/**
 * Cookies que dejan GA4 (`_ga`, `_ga_<id>`) y Clarity (`_clck`, `_clsk`).
 * Al retirar el consentimiento se borran: rechazar después de aceptar no debe
 * dejar el identificador guardado.
 */
export function esCookieDeAnalitica(nombre: string): boolean {
  return /^(_ga(_.+)?|_gid|_clck|_clsk)$/.test(nombre);
}
