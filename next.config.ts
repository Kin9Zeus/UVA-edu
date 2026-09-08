import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// P2-8 (AUDIT-2026-09-04.md): portadas de curso viven en el bucket público
// `portadas-cursos` de Supabase Storage — se deriva del mismo
// NEXT_PUBLIC_SUPABASE_URL que ya usa el resto de la app, en vez de
// hardcodear el project ref acá, para que siga funcionando si algún día
// hay un proyecto de Supabase distinto por entorno.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // P3-2 (AUDIT-2026-09-08): Next.js manda `X-Powered-By: Next.js` por
  // defecto. Confirmado en vivo en https://uva-edu-production.up.railway.app.
  //
  // El riesgo real es bajo y no conviene exagerarlo: el framework ya se
  // deduce de las rutas `/_next/static/`, así que esto no oculta nada a
  // quien mire. Lo que evita es aparecer en el barrido de un escáner
  // automatizado que filtra objetivos por cabecera —el que busca "todos los
  // Next.js" para probar el CVE de la semana— sin tener que mirar el HTML.
  // Cuesta una línea y no rompe nada: ninguna parte del producto lee esta
  // cabecera.
  poweredByHeader: false,

  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/portadas-cursos/**",
            },
          ]
        : []),
      // prisma/seed.ts genera portadas de ejemplo acá para no versionar
      // archivos de imagen en el repo. Solo en desarrollo: en producción
      // ninguna portada real sale de picsum.photos, así que no tiene
      // sentido abrirle la puerta al optimizador de next/image ahí.
      ...(process.env.NODE_ENV !== "production"
        ? [{ protocol: "https" as const, hostname: "picsum.photos" }]
        : []),
    ],
  },

  experimental: {
    serverActions: {
      // P2-7 (AUDIT-2026-09-04.md): antes era "52mb" para que
      // subirRecursoLeccion aceptara hasta 50 MB de material adicional —
      // pero Next no permite un límite distinto por Server Action, así que
      // ese valor aplicaba a TODAS, incluidas recuperar/registro/checkEmail
      // (sin sesión: cualquier anónimo podía mandar hasta 52 MB de body a
      // una de ellas antes de que el código de la acción corriera). Ahora
      // el material sube directo del navegador a Storage con una URL
      // firmada (crearSubidaRecurso/confirmarSubidaRecurso en
      // actions/admin/cursos.ts) y nunca pasa por acá, así que este límite
      // puede volver a algo cercano al default de Next (1 MB) sin romper
      // nada — 2 MB deja margen para el resto de las Server Actions del
      // proyecto sin abrir la misma puerta.
      bodySizeLimit: "2mb",
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
