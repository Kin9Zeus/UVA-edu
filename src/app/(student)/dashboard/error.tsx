"use client";

import { ErrorBlock } from "@/components/errores/ErrorBlock";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBlock
      codigo="500"
      codigoMuted
      titulo="Algo salió mal de nuestro lado"
      texto="El error ya quedó registrado y nuestro equipo fue notificado. Puedes reintentar en unos segundos; tu progreso no se pierde."
      accionPrimaria={{ label: "Reintentar", onClick: reset }}
      accionSecundaria={{ label: "Ir al inicio", href: "/dashboard" }}
      trace={`error_id: ${error.digest ?? "sin-id"}`}
    />
  );
}
