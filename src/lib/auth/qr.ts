import QRCode from "qrcode";

/**
 * El QR del segundo factor — FASE 8.1 del plan de blindaje.
 *
 * Se genera AQUÍ, a partir del secreto, y no se usa el `qr_code` que devuelve
 * Supabase. Tres razones, las tres vistas en la pantalla de activar:
 *
 * 1. NO SE PINTABA. Supabase entrega el SVG multilínea terminado en salto de
 *    línea; `next/image` rechaza un `src` que empiece o termine en espacio o
 *    carácter de control (el mensaje de ese error trae el SVG entero) y la
 *    página daba un 500 al pulsar «Empezar».
 *
 * 2. NO SE LEÍA. La dirección `otpauth` de Supabase mide 144 caracteres
 *    (`algorithm=SHA1&digits=6&issuer=supabase&period=30&secret=…`) y da un
 *    QR de 49×49 módulos, sin margen ni fondo. Una cámara de celular lo pierde
 *    en cuanto lo ve algo pequeño: en la prueba real, el de un iPhone lo leyó
 *    y el de un Android con Google Authenticator no.
 *
 * 3. DECÍA «supabase». La app de autenticación mostraba esa palabra como
 *    emisor, en vez de «U.V.A.».
 *
 * La dirección corta lleva solo lo esencial (emisor, cuenta y secreto): las
 * apps de autenticación asumen SHA1, 6 dígitos y 30 segundos cuando no se
 * indican, que es justo lo que usa Supabase. Son ~106 caracteres y un QR de
 * 37×37 módulos: cada módulo sale un 30 % más grande al mismo tamaño en
 * pantalla.
 */

/** Emisor que se ve en la app de autenticación. */
const EMISOR = "U.V.A.";

/** Margen blanco, en módulos: lo que pide la norma del QR para encontrar el código. */
const MODULOS_MARGEN = 4;

/** Lado al que se apunta, en píxeles. El real es un múltiplo entero del total de módulos. */
const LADO_OBJETIVO = 380;

/** Por debajo de esto los módulos son demasiado pequeños para una cámara de celular. */
const MIN_PX_POR_MODULO = 5;

/**
 * Dirección `otpauth` que codifica el QR. Un correo con caracteres especiales
 * se codifica; sin correo, la cuenta es solo el emisor.
 */
export function uriSegundoFactor({ secreto, correo }: { secreto: string; correo: string | undefined }): string {
  const emisor = encodeURIComponent(EMISOR);
  const cuenta = correo ? `${emisor}:${encodeURIComponent(correo)}` : emisor;

  return `otpauth://totp/${cuenta}?secret=${encodeURIComponent(secreto)}&issuer=${emisor}`;
}

export type QrParaPantalla = {
  /** `data:` listo para el `src` de `next/image`. */
  src: string;
  /** Lado en píxeles: múltiplo entero del total de módulos, para que ninguno salga a medio píxel. */
  lado: number;
};

/**
 * QR de activación como imagen lista para pintar.
 *
 * Nivel de corrección `L` y no `M`: el código se muestra en una pantalla, que
 * no se rasga ni se mancha, y con `L` el QR cabe en un tamaño menor (37×37 y no
 * 41×41), que es lo que de verdad ayuda a una cámara.
 */
export async function qrDeActivacion(datos: { secreto: string; correo: string | undefined }): Promise<QrParaPantalla> {
  const uri = uriSegundoFactor(datos);

  const { modules } = QRCode.create(uri, { errorCorrectionLevel: "L" });
  const totalModulos = modules.size + 2 * MODULOS_MARGEN;
  const pxPorModulo = Math.max(MIN_PX_POR_MODULO, Math.floor(LADO_OBJETIVO / totalModulos));

  const svg = await QRCode.toString(uri, {
    type: "svg",
    errorCorrectionLevel: "L",
    margin: MODULOS_MARGEN,
  });

  // `encodeURIComponent` y no `;base64`: el SVG es ASCII, y así no hace falta
  // `Buffer` ni `btoa` en un archivo que corre en el servidor y se prueba en
  // Node. `trim()`: `next/image` rechaza espacios o saltos en los bordes del `src`.
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`,
    lado: totalModulos * pxPorModulo,
  };
}
