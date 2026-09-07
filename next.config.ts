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

  // Cabeceras de seguridad HTTP. Ver AUDIT-2026-09-04.md, P2-2 (tercera
  // auditoría consecutiva que lo señala).
  //
  // La Content-Security-Policy queda fuera a propósito: necesita un nonce
  // por request (los scripts que el propio Next inyecta para el payload de
  // RSC) y este proyecto ya tiene src/proxy.ts corriendo en cada petición
  // — es el lugar correcto para eso, no una lista estática acá. Además,
  // una CSP mal calibrada puede romper el reproductor de Mux sin avisar
  // más que en la consola del navegador, así que esa parte se hace aparte
  // y se prueba en report-only antes de forzarla. Estas cinco no tienen
  // ese riesgo: no dependen de nada dinámico y nada en el código las
  // rompe (verificado, no supuesto — ver el porqué de cada una abajo).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Fuerza HTTPS en el navegador durante un año, incluidos
          // subdominios. Sin `preload` a propósito: eso exige enviar el
          // dominio a hstspreload.org y es prácticamente irreversible: una
          // vez ahí, todos los navegadores rechazan HTTP en el dominio
          // incluso antes de la primera visita, para siempre. No hay
          // razón para dar ese paso hasta confirmar que ningún subdominio
          // necesita HTTP alguna vez.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Evita que el navegador "adivine" el tipo real de un archivo
          // servido con un Content-Type distinto (MIME sniffing). Cobra
          // sentido en concreto porque la app sirve archivos subidos por
          // usuarios (recursos de lección, portadas de curso): sin esto,
          // un navegador podría llegar a ejecutar como HTML/JS un archivo
          // que el servidor etiquetó como otra cosa.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No se manda Referer al navegar a un origen distinto (protege
          // tokens o rutas con datos en la URL, p. ej. /verificar-certificado
          // /[codigo]); entre páginas del propio sitio sí viaja completo.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Cierra P2-2 en la parte que sí es explotable hoy sin depender
          // de ningún otro bug: sin esto, cualquier sitio puede enmarcar
          // U.V.A en un <iframe> propio y montar un ataque de clickjacking
          // sobre un usuario ya logueado. Verificado que no rompe nada:
          // ningún <iframe> en src/ enmarca la app ni ella enmarca a nadie.
          { key: "X-Frame-Options", value: "DENY" },
          // Apaga por defecto APIs del navegador que el producto no usa
          // (cámara, micrófono, geolocalización) e ignora el cálculo de
          // cohortes de FLoC (interest-cohort=()).
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
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
