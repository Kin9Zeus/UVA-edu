"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorBlock } from "@/components/errores/ErrorBlock";

/**
 * "Reintentar" usa `retry`, no `reset` (AUDIT-2026-09-22.md, seguimiento de
 * P2-3). `reset` solo vuelve a pintar el contenido con lo que el cliente ya
 * tiene, sin pedir nada al servidor, así que ante un error de servidor —una
 * caída de Supabase, el caso típico— el botón volvía a mostrar este mismo
 * error aunque la base ya estuviera de vuelta, y solo recargar la página lo
 * arreglaba. `retry` (estable desde Next 16.3,
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md)
 * vuelve a pedir el contenido al servidor. Verificado con el catálogo durante
 * una caída simulada.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // Este boundary ya le prometía al usuario "el equipo fue notificado" antes
  // de que existiera nada que lo notificara (P1-3, AUDIT-2026-08-24.md). El
  // servidor ya reporta este mismo error via onRequestError
  // (src/instrumentation.ts); capturarlo también aquí cubre los errores que
  // ocurren puramente en el cliente después de la hidratación, que
  // onRequestError nunca ve. `digest` (no el id de Sentry) sigue siendo lo
  // que se muestra: guardar el id de Sentry en estado forzaría un segundo
  // render solo para eso.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorBlock
      standalone
      codigo="500"
      codigoMuted
      titulo="Algo salió mal de nuestro lado"
      texto="El error ya quedó registrado y nuestro equipo fue notificado. Puedes reintentar en unos segundos; tu progreso no se pierde."
      accionPrimaria={{ label: "Reintentar", onClick: retry }}
      accionSecundaria={{ label: "Volver al inicio", href: "/" }}
      trace={`error_id: ${error.digest ?? "sin-id"}`}
    />
  );
}
