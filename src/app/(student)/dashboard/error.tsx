"use client";

import { PantallaError } from "@/components/errores/PantallaError";

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
    <PantallaError
      error={error}
      reintentar={retry}
      salida={{ label: "Ir al inicio", href: "/dashboard" }}
      soporteHref="/dashboard/soporte#contacto"
    />
  );
}
