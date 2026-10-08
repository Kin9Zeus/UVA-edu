import type { logError } from "@/lib/log";

/**
 * Reporte a Sentry desde componentes del navegador SIN importar el SDK de
 * forma estática (un import estático lo metería en el paquete que se ejecuta
 * antes de hidratar). Carga el SDK, lo inicia si todavía no lo estaba y
 * reporta. Solo para caminos raros (un error que ya ocurrió), nunca para
 * código que corre en cada visita.
 */

export function reportarErrorDelCliente(error: unknown) {
  void import("@/lib/sentry-cliente")
    .then((sentry) => {
      sentry.iniciarSentry();
      sentry.captureException(error);
    })
    .catch(() => {});
}

/** Igual que `logError` (lib/log.ts), para componentes `"use client"`. */
export function logErrorDelCliente(...args: Parameters<typeof logError>) {
  void import("@/lib/sentry-cliente")
    .then((sentry) => {
      sentry.iniciarSentry();
      return import("@/lib/log");
    })
    .then((modulo) => modulo.logError(...args))
    .catch(() => {});
}
