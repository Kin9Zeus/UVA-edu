"use client";

import { PantallaError } from "@/components/errores/PantallaError";

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
  return <PantallaError standalone error={error} reintentar={retry} salida={{ label: "Ir al inicio", href: "/" }} />;
}
