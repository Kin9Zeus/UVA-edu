/**
 * Google Analytics 4 (SEO fase 14, docs/seo/07-webmasters.md §7).
 *
 * Apagado por defecto: sin `NEXT_PUBLIC_GA_ID` no se carga ningún script ni
 * se abre la CSP a Google. Se enciende cuando esté resuelto si hace falta
 * aviso de cookies (docs/pendientes-equipo.md, fila 17).
 *
 * El id se valida porque va escrito dentro de un script en línea: una
 * variable mal puesta no debe poder inyectar código.
 *
 * Las vistas de página no necesitan código: la «medición mejorada» de GA4
 * las registra también en la navegación del lado del cliente (cambios del
 * historial), que es como navega el App Router.
 */
const id = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";

export const GA_ID: string | null = /^G-[A-Z0-9]+$/.test(id) ? id : null;

export type EventoAnalitica = "canje_invitacion" | "registro_completado" | "clic_whatsapp";

/** Envía un evento a GA4. Sin GA cargado (apagado o bloqueado) no hace nada. */
export function registrarEvento(nombre: EventoAnalitica, parametros?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  (window as { gtag?: (...args: unknown[]) => void }).gtag?.("event", nombre, parametros);
}

/** Script en línea que define `gtag` y configura la propiedad. */
export function scriptInicialGa(gaId: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}');`;
}
