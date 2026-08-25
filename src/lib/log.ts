import * as Sentry from "@sentry/nextjs";

/**
 * Log estructurado + reporte a Sentry (P1-3, AUDIT-2026-08-24.md).
 * Reemplaza los `console.error` sueltos que hasta ahora eran el único
 * rastro de un fallo: sin esto, "no pude registrarme" no tenía forma de
 * distinguir Supabase de Resend del trigger de `perfiles`, porque el
 * `console.error` con la causa real se perdía en el log efímero del
 * contenedor. Isomórfico a propósito: `@sentry/nextjs` resuelve el SDK
 * correcto según el bundle (cliente, servidor o edge), así que el mismo
 * `logError` sirve tanto en Server Actions/Route Handlers como en
 * componentes "use client".
 *
 * El `eventId` que devuelve Sentry (no un UUID generado a mano) es el
 * identificador de correlación: aparece igual en el log de consola y en el
 * evento de Sentry, así que buscar uno encuentra el otro.
 *
 * `context.area` se promueve a tag de Sentry (además de `scope`) para las
 * alertas mínimas del hallazgo: "webhook" agrupa los tres proveedores de
 * pago/video, "email" agrupa los tres puntos que envían correo vía Resend.
 */
export function logError(
  scope: string,
  message: string,
  error?: unknown,
  context?: Record<string, unknown> & { area?: string },
): string {
  const err =
    error instanceof Error
      ? error
      : new Error(error != null ? `${message}: ${String(error)}` : message);

  const { area, ...extra } = context ?? {};

  const eventId = Sentry.captureException(err, {
    tags: { scope, ...(area ? { area } : {}) },
    extra: { message, ...extra },
  });

  console.error(
    JSON.stringify({
      nivel: "error",
      timestamp: new Date().toISOString(),
      eventId,
      scope,
      ...(area ? { area } : {}),
      message,
      error: { nombre: err.name, mensaje: err.message },
      ...extra,
    }),
  );

  return eventId;
}
