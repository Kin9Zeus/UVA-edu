"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorBlock } from "@/components/errores/ErrorBlock";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
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
      accionPrimaria={{ label: "Reintentar", onClick: reset }}
      accionSecundaria={{ label: "Volver al inicio", href: "/" }}
      trace={`error_id: ${error.digest ?? "sin-id"}`}
    />
  );
}
