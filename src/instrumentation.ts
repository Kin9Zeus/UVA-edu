import * as Sentry from "@sentry/nextjs";

/**
 * P1-3 (AUDIT-2026-08-24.md): monitoreo de errores del lado del servidor.
 * `register()` corre una vez al iniciar el servidor de Next.js, antes de
 * aceptar peticiones (docs/app/guides/instrumentation.md) — es el único
 * punto correcto para `Sentry.init` en Node y en Edge, ambos runtimes que
 * usan las rutas de este proyecto (webhooks, Server Actions).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // 10%: suficiente para ver latencia real sin pagar por cada request.
      // Los webhooks y Server Actions de auth son de bajo volumen hoy.
      tracesSampleRate: 0.1,
      // Sin DSN (entorno local sin configurar), el SDK no envía nada — no
      // hace falta apagarlo condicionalmente.
    });
  }
}

/**
 * Next.js llama esto con todo error no atrapado de Server Components, Route
 * Handlers y Server Actions (docs/app/api-reference/file-conventions/
 * instrumentation.md). `captureRequestError` ya sabe extraer la ruta, el
 * método y el tipo de router del `context` que recibe.
 */
export const onRequestError = Sentry.captureRequestError;
