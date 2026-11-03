import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Cierre del origen (fase 2 del plan de blindaje).
 *
 * Con Cloudflare delante, una regla de transformación le agrega a cada
 * petición la cabecera `X-Origen-Uva` con un secreto largo. Quien llame
 * directo a Railway, saltándose Cloudflare (y con eso el WAF, los límites y
 * el bloqueo de bots), no la conoce: `src/proxy.ts` le responde 403.
 *
 * Mientras `ORIGEN_SECRETO` no esté puesta, nada de esto actúa: el sitio
 * funciona igual que sin Cloudflare. Así el código se despliega antes de
 * tener el dominio, y el cierre se enciende o se apaga con una variable de
 * Railway (orden y vuelta atrás en docs/ops/cloudflare.md).
 */

export const CABECERA_ORIGEN = "x-origen-uva";

/**
 * Rutas que responden aunque no traigan la cabecera:
 * - `/api/health`: la consultan el chequeo de despliegue de Railway, que
 *   llama directo al contenedor, y el monitor de disponibilidad. Es de solo
 *   lectura y no devuelve datos.
 */
const RUTAS_SIN_CABECERA = new Set(["/api/health"]);

/**
 * Lo que no necesita sesión ni CSP: archivos del build, imágenes optimizadas
 * y archivos de `public/`. `src/proxy.ts` las revisa solo para el cierre del origen.
 */
export const RUTA_SIN_SESION = /^\/(?:_next\/static\/|_next\/image|favicon\.ico$)|\.(?:svg|png|jpg|jpeg|gif|webp)$/;

/** El secreto vigente, o null si el cierre está apagado. */
export function secretoDeOrigen(valor = process.env.ORIGEN_SECRETO): string | null {
  const secreto = valor?.trim();
  return secreto ? secreto : null;
}

/**
 * true si la cabecera trae exactamente el secreto. Compara los resúmenes
 * SHA-256 con `timingSafeEqual`: el tiempo de respuesta no revela cuántos
 * caracteres acertó quien prueba, y los dos lados miden siempre lo mismo.
 */
export function cabeceraDeOrigenValida(recibida: string | null | undefined, secreto: string): boolean {
  if (!recibida) return false;
  const a = createHash("sha256").update(recibida).digest();
  const b = createHash("sha256").update(secreto).digest();
  return timingSafeEqual(a, b);
}

/**
 * true si la petición pasó por Cloudflare: el cierre está encendido y la
 * cabecera coincide. Con el cierre apagado devuelve false, porque entonces
 * no hay forma de saber si pasó o no.
 */
export function peticionDesdeCloudflare(recibida: string | null | undefined, valor = process.env.ORIGEN_SECRETO): boolean {
  const secreto = secretoDeOrigen(valor);
  return secreto !== null && cabeceraDeOrigenValida(recibida, secreto);
}

/** Lo que `src/proxy.ts` hace con la petición. */
export function decidirOrigen(
  ruta: string,
  recibida: string | null | undefined,
  valor = process.env.ORIGEN_SECRETO,
): "seguir" | "rechazar" {
  const secreto = secretoDeOrigen(valor);
  if (secreto === null) return "seguir";
  if (RUTAS_SIN_CABECERA.has(ruta)) return "seguir";
  return cabeceraDeOrigenValida(recibida, secreto) ? "seguir" : "rechazar";
}
