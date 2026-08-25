import { randomInt } from "node:crypto";

/**
 * Alfabeto de los códigos de invitación.
 *
 * Se excluyen a propósito los caracteres que se confunden al leerlos o
 * dictarlos: 0/O, 1/I/L. Un código de invitación se comparte por WhatsApp,
 * se lee de una diapositiva o se dicta por teléfono — a diferencia del token
 * de vista previa, que solo viaja por copiar y pegar. Un "0" que alguien
 * teclea como "O" es un canje fallido y una consulta a soporte.
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Largo del código, sin contar el guion separador. */
const LARGO = 8;

/**
 * Genera un código legible del tipo `UVA-K7M2-QP4X`.
 *
 * Usa `randomInt` (CSPRNG) y no `Math.random()`: aunque el canje esté
 * limitado por intentos (023_rate_limit_check_email_y_canje.sql), un
 * generador predecible dejaría deducir códigos ajenos a partir de uno
 * propio.
 *
 * 31^8 ≈ 8.5e11 combinaciones. No es un secreto criptográfico como el token
 * de vista previa (43 caracteres): aquí el equilibrio es entre que sea
 * imposible de adivinar por fuerza bruta y que un humano pueda teclearlo.
 * El rate limit por usuario es lo que cubre la diferencia.
 */
export function generarCodigoInvitacion(prefijo = "UVA"): string {
  let cuerpo = "";
  for (let i = 0; i < LARGO; i += 1) {
    cuerpo += ALFABETO[randomInt(ALFABETO.length)];
  }
  // Se parte en bloques de 4 para que sea más fácil de leer y de dictar.
  return `${prefijo}-${cuerpo.slice(0, 4)}-${cuerpo.slice(4)}`;
}

/**
 * Normaliza lo que escribe el usuario al canjear: mayúsculas y sin espacios
 * sobrantes. No toca los guiones, para que el valor coincida exactamente
 * con el guardado.
 */
export function normalizarCodigo(entrada: string): string {
  return entrada.trim().toUpperCase().replace(/\s+/g, "");
}

export type EstadoCodigo = "ACTIVO" | "INACTIVO" | "VENCIDO" | "AGOTADO";

/**
 * Estado real de un código, combinando sus tres formas de dejar de servir.
 * El orden importa: replica el de canjear_codigo_invitacion() (017) para
 * que el panel muestre el mismo motivo que vería quien intenta canjearlo.
 */
export function estadoCodigo(codigo: {
  activo: boolean;
  fechaVencimiento: string | Date;
  limiteUsos: number | null;
  vecesUsado: number;
}): EstadoCodigo {
  if (!codigo.activo) return "INACTIVO";

  const vence = new Date(codigo.fechaVencimiento);
  if (vence.getTime() < Date.now()) return "VENCIDO";

  if (codigo.limiteUsos !== null && codigo.vecesUsado >= codigo.limiteUsos) {
    return "AGOTADO";
  }

  return "ACTIVO";
}
