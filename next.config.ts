import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Action de subida de material adicional (subirRecursoLeccion,
      // src/actions/admin/cursos.ts) valida hasta 50 MB de archivo (el
      // máximo que acepta Supabase Storage); el límite por defecto de Next
      // es 1 MB. Se deja margen extra para el overhead de
      // multipart/form-data (boundaries, headers de cada parte).
      bodySizeLimit: "52mb",
    },
  },
};

// P1-3 (AUDIT-2026-08-24.md): sube source maps a Sentry en el build para que
// los stack traces de producción (código minificado) se lean como el
// código fuente real. Sin SENTRY_AUTH_TOKEN (no configurado todavía en
// GitHub/Railway — paso manual, igual que P1-2) esto no falla el build:
// silent evita que el aviso de "no autenticado" se confunda con un error.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
