import { captureException, captureRouterTransitionStart, init } from "@sentry/nextjs";

/**
 * Lo único que el navegador usa de `@sentry/nextjs`, reexportado por nombre.
 * Solo se carga con `import()` (ver `instrumentation-client.ts` y
 * `reportar-cliente.ts`), nunca de forma estática: iniciar Sentry antes de
 * hidratar sumaba ~230 ms de TBT en móvil. Importar el paquete entero con
 * `import("@sentry/nextjs")` arrastraba todas sus funciones (172 KiB
 * comprimidos); con imports nombrados el empaquetador descarta el resto.
 */

let iniciado = false;

/** Inicia el SDK una sola vez, venga de donde venga la primera llamada. */
export function iniciarSentry() {
  if (iniciado) return;
  iniciado = true;
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // `next dev` no reporta (ver src/instrumentation.ts).
    enabled: process.env.NODE_ENV === "production",
  });
}

export { captureException, captureRouterTransitionStart };
