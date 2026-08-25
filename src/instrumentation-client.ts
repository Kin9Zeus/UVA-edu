import * as Sentry from "@sentry/nextjs";

/**
 * P1-3 (AUDIT-2026-08-24.md): monitoreo de errores del lado del cliente.
 * Convención de Next 16.3 (antes `sentry.client.config.ts`): este archivo
 * corre después de cargar el HTML y antes de la hidratación de React
 * (docs/app/api-reference/file-conventions/instrumentation-client.md).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// Requerido por el SDK para instrumentar navegaciones del App Router; sin
// esto el wizard/build advierte "ACTION REQUIRED" en cada compilación.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
