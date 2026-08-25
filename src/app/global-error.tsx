"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorBlock } from "@/components/errores/ErrorBlock";
import "./globals.css";

/**
 * P1-3 (AUDIT-2026-08-24.md): red de seguridad para errores en el
 * `RootLayout` mismo (ej. una fuente o un provider que revienta antes de
 * montar `<body>`). `src/app/error.tsx` no los atrapa — un error boundary
 * de App Router nunca cubre a su propio layout padre — y por eso Next.js
 * exige que este archivo reemplace `<html>`/`<body>` enteros en vez de
 * anidarse dentro de ellos.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es" className="dark antialiased">
      <body className="min-h-full">
        <ErrorBlock
          standalone
          codigo="500"
          codigoMuted
          titulo="Algo salió mal de nuestro lado"
          texto="El error ya quedó registrado y nuestro equipo fue notificado. Intenta recargar la página en unos segundos."
          accionPrimaria={{ label: "Recargar", href: "/" }}
          accionSecundaria={{ label: "Volver al inicio", href: "/" }}
          trace={`error_id: ${error.digest ?? "sin-id"}`}
        />
      </body>
    </html>
  );
}
