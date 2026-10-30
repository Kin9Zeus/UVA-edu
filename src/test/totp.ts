import { createHmac } from "node:crypto";

/**
 * Generador de códigos TOTP (RFC 6238) para PRUEBAS — FASE 8.1.
 *
 * Desde `131_admin_exige_aal2.sql`, un administrador solo tiene poder con
 * sesión aal2: `npm run test:rls` necesita una sesión de admin que haya pasado
 * el segundo factor de verdad, contra Supabase. Esto calcula el código que
 * mostraría una app de autenticación a partir del secreto que devuelve
 * `mfa.enroll()`, sin añadir una dependencia solo para pruebas.
 *
 * Mismos parámetros que Supabase y las apps cuando no se indican otros:
 * HMAC-SHA1, 6 dígitos, periodos de 30 segundos. Vive en `src/test/` y no en
 * `src/lib/`: la app nunca genera códigos, solo los verifica Supabase.
 */

const ALFABETO_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decodifica Base32 (RFC 4648), el formato del secreto de las apps de autenticación. */
function base32ABytes(secreto: string): Buffer {
  const limpio = secreto.replace(/[\s=]/g, "").toUpperCase();
  let bits = "";
  for (const caracter of limpio) {
    const valor = ALFABETO_BASE32.indexOf(caracter);
    if (valor === -1) throw new Error(`Carácter no válido en un secreto Base32: «${caracter}»`);
    bits += valor.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Código TOTP para el instante `ahoraMs` (por defecto, ahora). */
export function generarCodigoTotp(
  secretoBase32: string,
  ahoraMs: number = Date.now(),
  { digitos = 6, periodoSegundos = 30 }: { digitos?: number; periodoSegundos?: number } = {},
): string {
  const contador = Math.floor(ahoraMs / 1000 / periodoSegundos);

  const mensaje = Buffer.alloc(8);
  mensaje.writeBigUInt64BE(BigInt(contador));

  const hmac = createHmac("sha1", base32ABytes(secretoBase32)).update(mensaje).digest();

  // Truncado dinámico (RFC 4226 §5.3).
  const desplazamiento = hmac[hmac.length - 1] & 0x0f;
  const binario =
    ((hmac[desplazamiento] & 0x7f) << 24) |
    (hmac[desplazamiento + 1] << 16) |
    (hmac[desplazamiento + 2] << 8) |
    hmac[desplazamiento + 3];

  return String(binario % 10 ** digitos).padStart(digitos, "0");
}
