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
export function normalizarCodigoCertificado(texto: string): string {
  const limpio = texto.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{10}$/.test(limpio) ? `${limpio.slice(0, 5)}-${limpio.slice(5)}` : limpio;
}
