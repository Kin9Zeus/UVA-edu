import type { Breadcrumb, Event } from "@sentry/nextjs";

/**
 * Lo que nunca debe llegar a Sentry — FASE 7 (datos, tarea 2) del plan de
 * blindaje: correos, contraseñas, códigos de un solo uso ni cuerpos de
 * formularios. Lo usan el servidor (instrumentation.ts), el navegador
 * (sentry-cliente.ts) y los crons que inician Sentry por su cuenta.
 *
 * Con `sendDefaultPii: false` (explícito en cada `init`) el SDK ya deja fuera
 * la IP, el usuario, los cuerpos de las peticiones y las cookies y encabezados
 * con nombres sensibles. Esto cubre lo que queda:
 *
 * - Correos dentro de texto libre: el mensaje de un error de Supabase o de
 *   Resend, una migaja de consola, una URL. `logError` (lib/log.ts) ya
 *   redacta por NOMBRE de llave en su `context`; esto redacta por FORMA, solo
 *   el patrón de un correo, para no borrar la pista real del error.
 * - Parámetros de URL que son credenciales: los enlaces de confirmación y de
 *   recuperación llevan `code` o `token_hash`; con eso alguien podría usar el
 *   enlace mientras siga vigente.
 * - Por si acaso, cookies, cuerpo y usuario del evento, aunque el SDK ya no
 *   los mande: si alguien activa `sendDefaultPii` un día, esto sigue en pie.
 */

const CORREO = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CORREO_REDACTADO = "[correo]";
const VALOR_REDACTADO = "[filtrado]";

/** Parámetros de URL cuyo valor es una credencial o un dato personal. */
const PARAMETRO_SENSIBLE = /^(code|token|token_hash|access_token|refresh_token|email|correo|password|key|secret)$/i;

/** Encabezados que identifican a la persona o su sesión. */
const ENCABEZADO_SENSIBLE = /^(cookie|set-cookie|authorization|x-forwarded-for|x-real-ip|cf-connecting-ip|x-origen-uva)$/i;

const PROFUNDIDAD_MAXIMA = 5;

function sinCorreos(texto: string): string {
  return texto.replace(CORREO, CORREO_REDACTADO);
}

/** Redacta los parámetros sensibles de una URL (absoluta o relativa) o de un query string. */
export function limpiarUrl(url: string): string {
  const inicioQuery = url.indexOf("?");
  const soloQuery = inicioQuery === -1 && url.includes("=") && !url.includes("/");
  if (inicioQuery === -1 && !soloQuery) return sinCorreos(url);

  const base = soloQuery ? "" : url.slice(0, inicioQuery + 1);
  const resto = soloQuery ? url : url.slice(inicioQuery + 1);
  const [query, fragmento] = resto.split("#", 2);

  const limpia = query
    .split("&")
    .map((par) => {
      const igual = par.indexOf("=");
      if (igual === -1) return par;
      const llave = par.slice(0, igual);
      let nombre = llave;
      try {
        nombre = decodeURIComponent(llave);
      } catch {
        // Llave mal codificada: se compara tal cual.
      }
      return PARAMETRO_SENSIBLE.test(nombre) ? `${llave}=${VALOR_REDACTADO}` : par;
    })
    .join("&");

  return sinCorreos(base + limpia + (fragmento !== undefined ? `#${fragmento}` : ""));
}

/** Recorre un valor cualquiera y quita correos de cada texto, con tope de profundidad. */
function limpiarValor(valor: unknown, profundidad = 0): unknown {
  if (typeof valor === "string") return sinCorreos(valor);
  if (profundidad >= PROFUNDIDAD_MAXIMA || valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map((v) => limpiarValor(v, profundidad + 1));
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).map(([llave, v]) => [llave, limpiarValor(v, profundidad + 1)]),
  );
}

/** Para `beforeSend` y `beforeSendTransaction`. Modifica y devuelve el mismo evento. */
export function limpiarEventoSentry<T extends Event>(evento: T): T {
  delete evento.user;

  if (evento.message) evento.message = sinCorreos(evento.message);

  for (const excepcion of evento.exception?.values ?? []) {
    if (excepcion.value) excepcion.value = sinCorreos(excepcion.value);
  }

  if (evento.request) {
    const peticion = evento.request;
    delete peticion.cookies;
    delete peticion.data;
    if (peticion.url) peticion.url = limpiarUrl(peticion.url);
    if (typeof peticion.query_string === "string") {
      peticion.query_string = limpiarUrl(peticion.query_string);
    } else if (peticion.query_string) {
      peticion.query_string = limpiarUrl(`?${new URLSearchParams(peticion.query_string as Record<string, string>)}`).slice(1);
    }
    if (peticion.headers) {
      for (const encabezado of Object.keys(peticion.headers)) {
        if (ENCABEZADO_SENSIBLE.test(encabezado)) peticion.headers[encabezado] = VALOR_REDACTADO;
      }
      if (peticion.headers.referer) peticion.headers.referer = limpiarUrl(peticion.headers.referer);
    }
  }

  if (evento.extra) evento.extra = limpiarValor(evento.extra) as T["extra"];
  if (evento.contexts) evento.contexts = limpiarValor(evento.contexts) as T["contexts"];
  if (evento.breadcrumbs) evento.breadcrumbs = evento.breadcrumbs.map(limpiarMigajaSentry);

  return evento;
}

/** Para `beforeBreadcrumb`: navegaciones, fetch y consola llevan URLs y texto libre. */
export function limpiarMigajaSentry(migaja: Breadcrumb): Breadcrumb {
  if (migaja.message) migaja.message = sinCorreos(migaja.message);
  if (migaja.data) {
    const datos = limpiarValor(migaja.data) as Record<string, unknown>;
    for (const llave of ["url", "from", "to"]) {
      if (typeof datos[llave] === "string") datos[llave] = limpiarUrl(datos[llave] as string);
    }
    migaja.data = datos;
  }
  return migaja;
}

/** Las opciones de privacidad que comparten todos los `Sentry.init` del proyecto. */
export const opcionesPrivacidadSentry = {
  sendDefaultPii: false,
  beforeSend: limpiarEventoSentry,
  beforeSendTransaction: limpiarEventoSentry,
  beforeBreadcrumb: limpiarMigajaSentry,
} as const;
