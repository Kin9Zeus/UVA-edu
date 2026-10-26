/**
 * Deja un código de certificado como se guarda en la base, para que el
 * mismo código escrito de otra forma ("k7m2q xp4tb", "K7M2QXP4TB") lo
 * encuentre.
 *
 * - Quita espacios y pasa a mayúsculas: los códigos solo usan mayúsculas.
 * - Si quedan 10 letras o números sin guion, pone el guion en medio: es el
 *   formato que genera `private.generar_codigo_certificado()` (047).
 *
 * Cualquier otra forma se deja como vino (solo en mayúsculas): hay
 * certificados de siembra con otro formato ("UVA-2026-REVIT-…") y no se
 * deben romper.
 */
/** Largo máximo del campo: 5 + guion + 5. */
export const LARGO_MAXIMO_CODIGO_CERTIFICADO = 11;

/**
 * Da forma al código mientras se escribe en el campo: mayúsculas, solo letras
 * y números, máximo 10 y el guion puesto solo después del quinto. Al borrar
 * (`borrando`) no se deja el guion colgando, o no se podría borrar pasado el
 * quinto carácter.
 */
export function formatearCodigoCertificadoEscribiendo(texto: string, borrando = false): string {
  const cuerpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  if (cuerpo.length < 5 || (cuerpo.length === 5 && borrando)) return cuerpo;
  return `${cuerpo.slice(0, 5)}-${cuerpo.slice(5)}`;
}

export function normalizarCodigoCertificado(texto: string): string {
  const limpio = texto.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{10}$/.test(limpio) ? `${limpio.slice(0, 5)}-${limpio.slice(5)}` : limpio;
}
