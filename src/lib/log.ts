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
// Monitoreo/alertas — "registro estructurado sin datos personales ni
// tokens en los logs". Ningún llamado actual a logError pasa una de estas
// llaves en `context` (auditado a mano en toda la base al agregar esto),
// pero es fácil que alguien la agregue sin pensarlo dentro de un año —
// redactar por nombre de llave es la red de seguridad, no una promesa de
// que nunca pasará. No toca `error.message`: viene de Supabase/Mux/Resend
// tal cual, y redactar texto libre por regex arriesga destruir la pista
// real sin garantizar nada (un mensaje puede mencionar un correo de mil
// formas distintas).
const LLAVES_SENSIBLES =
  /email|correo|password|contrase|token|secret|authorization|cookie|tarjeta|cvv|credito|cedula|documento|telefono|phone|direccion|ssn|dni/i;

function redactar(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 3) return valor;
  if (Array.isArray(valor)) return valor.map((v) => redactar(v, profundidad + 1));
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([llave, v]) => [
        llave,
        LLAVES_SENSIBLES.test(llave) ? "[redactado]" : redactar(v, profundidad + 1),
      ]),
    );
  }
  return valor;
}

export function logError(
  scope: string,
  message: string,
  error?: unknown,
  context?: Record<string, unknown> & { area?: string },
): string {
  const err = error instanceof Error ? error : new Error(message);

  const { area, ...extraCrudo } = context ?? {};
  const extra = redactar(extraCrudo) as Record<string, unknown>;
  // `error` casi siempre es un Error (auth de Supabase, Mux, Resend), pero
  // un PostgrestError (`.from().select()`) es un objeto plano — sin esto,
  // `err` de arriba no lo contiene y el código/hint/details reales de
  // Postgres desaparecían por completo, tanto de consola como de Sentry.
  const causaOriginal =
    error !== undefined && !(error instanceof Error) ? redactar(error) : undefined;

  const eventId = Sentry.captureException(err, {
    tags: { scope, ...(area ? { area } : {}) },
    extra: { message, ...(causaOriginal !== undefined ? { causaOriginal } : {}), ...extra },
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
      ...(causaOriginal !== undefined ? { causaOriginal } : {}),
      ...extra,
    }),
  );

  return eventId;
}
