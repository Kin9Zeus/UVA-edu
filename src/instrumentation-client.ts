import * as Sentry from "@sentry/nextjs";
import { config as configurarZod } from "zod";

/**
 * Zod v4 prueba si puede compilar validadores con `Function("")` (su modo
 * JIT). La CSP no permite `unsafe-eval`, así que cada prueba era un reporte
 * `Blocked 'script' from 'eval:'` en Sentry (UVA-EDU-1S) — sin romper nada,
 * porque Zod atrapa el fallo y valida sin JIT. `jitless` se salta la prueba:
 * mismo resultado, sin el reporte. Va aquí porque este archivo corre antes
 * que cualquier componente que valide con Zod. En el servidor no aplica
 * (no hay CSP), así que ahí el JIT sigue activo.
 */
configurarZod({ jitless: true });

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
