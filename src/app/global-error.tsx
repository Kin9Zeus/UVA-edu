"use client";

import { PantallaError } from "@/components/errores/PantallaError";
import "./globals.css";

/**
 * P1-3 (AUDIT-2026-08-24.md): red de seguridad para errores en el
 * `RootLayout` mismo (ej. una fuente o un provider que revienta antes de
 * montar `<body>`). `src/app/error.tsx` no los atrapa — un error boundary
 * de App Router nunca cubre a su propio layout padre — y por eso Next.js
 * exige que este archivo reemplace `<html>`/`<body>` enteros en vez de
 * anidarse dentro de ellos.
 *
 * "Reintentar" recarga la página entera: lo que falló es el layout raíz, y
 * `retry` volvería a pintarlo sobre lo mismo. Antes era un enlace a "/" con
 * la etiqueta "Recargar", que no recargaba.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="es" className="dark antialiased">
      <body className="min-h-full">
        <PantallaError
          standalone
          error={error}
          reintentar={() => window.location.reload()}
          salida={{ label: "Ir al inicio", href: "/" }}
        />
      </body>
    </html>
  );
}
