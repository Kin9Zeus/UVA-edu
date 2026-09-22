"use client";

import { ErrorBlock } from "@/components/errores/ErrorBlock";

// "Reintentar" usa `retry` (vuelve a pedir el contenido al servidor), no
// `reset`, que solo repinta y no recupera de un error de servidor. Ver
// src/app/error.tsx.
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorBlock
      codigo="500"
      codigoMuted
      titulo="Algo salió mal de nuestro lado"
      texto="El error ya quedó registrado y nuestro equipo fue notificado. Puedes reintentar en unos segundos; tu progreso no se pierde."
      accionPrimaria={{ label: "Reintentar", onClick: retry }}
      accionSecundaria={{ label: "Ir al inicio", href: "/dashboard" }}
      trace={`error_id: ${error.digest ?? "sin-id"}`}
    />
  );
}
