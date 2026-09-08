/**
 * Content-Security-Policy con nonce por petición.
 *
 * P2-2 (AUDIT-2026-09-08, señalado también el 24-ago, el 26-ago y el 4-sep).
 * Es la única cabecera de seguridad que faltaba: HSTS, X-Content-Type-Options,
 * Referrer-Policy, X-Frame-Options y Permissions-Policy ya salen de
 * `next.config.ts`. Esta no puede vivir ahí porque necesita un valor distinto
 * en cada petición.
 *
 * Cómo aplica Next el nonce (verificado en node_modules/next/dist/docs/
 * 01-app/02-guides/content-security-policy.md, no de memoria)
 * ---------------------------------------------------------------------
 * Next lee el header **`Content-Security-Policy` de la PETICIÓN**, extrae el
 * valor de `'nonce-...'` y se lo pone solo a sus propios scripts: runtime de
 * React/Next, los bundles de la página y los scripts en línea que genera
 * (el `self.__next_f.push(...)` con el payload de RSC). Por eso `src/proxy.ts`
 * pone la cabecera en la petición aunque en la RESPUESTA mande
 * `Content-Security-Policy-Report-Only`: sin la de petición, Next no
 * numeraría sus scripts y el informe se llenaría de violaciones falsas de
 * nuestro propio framework, que es justo lo que haría inservible la fase de
 * observación.
 *
 * Esta lista de orígenes está MEDIDA, no supuesta: sale de recorrer los
 * paquetes de `@mux` en node_modules y las URLs citadas en `src/`. Ver el
 * porqué de cada uno abajo.
 */

export type OpcionesCsp = {
  /** 128 bits en base64, distinto en cada petición. Ver generarNonce(). */
  nonce: string;
  /** `next dev` necesita permisos que producción no debe tener. */
  desarrollo: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL. Sin ella se omiten sus orígenes. */
  supabaseUrl?: string;
  /** NEXT_PUBLIC_SENTRY_DSN, para connect-src y para report-uri. */
  sentryDsn?: string;
};

/** Host de una URL, o null si no parsea. Nunca lanza: una variable mal puesta
 *  debe degradar la política, no tumbar cada petición del sitio. */
function host(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Endpoint de informes de CSP de Sentry, derivado del DSN.
 *
 * El DSN tiene la forma `https://<clave>@<host>/<proyecto>` y el endpoint de
 * seguridad es `https://<host>/api/<proyecto>/security/?sentry_key=<clave>`.
 * Se deriva en vez de configurarse aparte para que no puedan divergir.
 *
 * Sin esto, `Report-Only` solo escribe en la consola del navegador de cada
 * visitante — es decir, en ningún sitio que alguien vaya a mirar. La fase de
 * observación no sirve de nada si los informes no llegan.
 */
export function endpointInformesCsp(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const proyecto = url.pathname.replace(/^\//, "");
    if (!url.username || !proyecto) return null;
    return `https://${url.host}/api/${proyecto}/security/?sentry_key=${url.username}`;
  } catch {
    return null;
  }
}

/** 128 bits de CSPRNG en base64. Debe ser impredecible: un nonce adivinable
 *  no protege de nada, porque el atacante lo pondría en su propio script. */
export function generarNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
}

export function construirCsp(opciones: OpcionesCsp): string {
  const { nonce, desarrollo, supabaseUrl, sentryDsn } = opciones;

  const supabase = host(supabaseUrl);
  const sentry = host(sentryDsn);
  const informes = endpointInformesCsp(sentryDsn);

  const directivas: Record<string, (string | false | null)[]> = {
    "default-src": ["'self'"],

    // 'strict-dynamic' es lo que hace fuerte a esta política: un script con
    // nonce válido puede cargar otros, y los navegadores que lo entienden
    // IGNORAN 'self' y cualquier lista de dominios en esta directiva. Los
    // dos se dejan igual como respaldo para navegadores de CSP nivel 2.
    //
    // Por eso no hace falta listar aquí src.litix.io ni ningún CDN: si algún
    // día el reproductor carga un script propio, lo hará desde un script ya
    // numerado y 'strict-dynamic' lo permite.
    //
    // 'unsafe-eval' solo en desarrollo: React usa eval para reconstruir en el
    // navegador los stacks de error del servidor. En producción ni React ni
    // Next lo usan.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      desarrollo && "'unsafe-eval'",
    ],

    // 'unsafe-inline' aquí es una concesión deliberada, no un descuido.
    //
    // Un nonce NO autoriza atributos `style=""`, solo elementos <style> y
    // <link>. El producto tiene 10 atributos de ese tipo —las barras de
    // progreso, que calculan `width` con un porcentaje en tiempo de
    // render— y con `style-src 'self' 'nonce-...'` se romperían todas.
    //
    // Se acepta porque el riesgo no es comparable: una inyección de CSS
    // puede exfiltrar por selectores de atributo o deformar la interfaz,
    // pero no ejecuta código. script-src, que es donde está el peligro real,
    // sigue sin 'unsafe-inline'.
    //
    // Para cerrarlo haría falta sacar esos 10 anchos a clases o a hojas de
    // estilo generadas; `style-src-attr` no sirve como atajo porque su
    // soporte no es universal y el respaldo sería justo esta directiva.
    "style-src": ["'self'", "'unsafe-inline'"],

    // Supabase Storage sirve las portadas desde el bucket público.
    // image.mux.com son las miniaturas/póster del reproductor; img.litix.io
    // es el píxel de telemetría de Mux Data. picsum solo lo usa el seed.
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      supabase && `https://${supabase}`,
      "https://image.mux.com",
      "https://img.litix.io",
      desarrollo && "https://picsum.photos",
    ],

    // El video va por HLS desde stream.mux.com, y el reproductor arma los
    // segmentos como blob: antes de dárselos al elemento <video>.
    "media-src": ["'self'", "blob:", "https://stream.mux.com"],

    // next/font descarga las tipografías en tiempo de build y las sirve desde
    // /_next/static/media — no hay ninguna petición a fonts.gstatic.com en
    // tiempo de ejecución (verificado en la respuesta del dominio real: los
    // preload de woff2 apuntan a /_next/).
    "font-src": ["'self'"],

    // stream.mux.com: manifiestos y segmentos. stats.mux.com: telemetría de
    // reproducción. El wss de Supabase es Realtime (códigos de invitación).
    // ws: en desarrollo es el socket de Hot Module Reload.
    "connect-src": [
      "'self'",
      supabase && `https://${supabase}`,
      supabase && `wss://${supabase}`,
      "https://stream.mux.com",
      "https://stats.mux.com",
      sentry && `https://${sentry}`,
      desarrollo && "ws:",
    ],

    // El reproductor descompone HLS en un worker creado desde un blob.
    "worker-src": ["'self'", "blob:"],

    // Ningún componente de src/ monta un <iframe> (verificado por grep), así
    // que nada que enmarcar. frame-ancestors duplica el X-Frame-Options: DENY
    // de next.config.ts a propósito — es el sucesor moderno y el que
    // entienden los navegadores actuales.
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],

    // Cierra la reescritura de <base href>, que convertiría cualquier ruta
    // relativa en una absoluta hacia el atacante.
    "base-uri": ["'self'"],
    // Los formularios del producto (login, registro, recuperación) postean
    // siempre al propio origen. El OAuth de Google no es un form: es una
    // navegación por redirect, que esta directiva no toca.
    "form-action": ["'self'"],

    "manifest-src": ["'self'"],
  };

  const partes = Object.entries(directivas).map(([nombre, valores]) => {
    const usables = valores.filter((v): v is string => Boolean(v));
    return `${nombre} ${usables.join(" ")}`;
  });

  // Sin `upgrade-insecure-requests` en desarrollo: forzaría a https el
  // http://localhost:3000 con el que corren `next dev` y Playwright.
  if (!desarrollo) partes.push("upgrade-insecure-requests");

  if (informes) partes.push(`report-uri ${informes}`);

  return partes.join("; ");
}
