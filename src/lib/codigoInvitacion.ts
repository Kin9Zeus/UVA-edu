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

/** Cuántos caracteres alfanuméricos tiene un código sin contar los guiones: 3 (prefijo) + 4 + 4. */
const LARGO_SIN_GUIONES = 11;

/**
 * Reformatea lo que va tecleando el usuario al formato `UVA-K7M2-QP4X`
 * (CanjearCodigoForm.tsx), insertando los guiones solos a medida que
 * escribe. Recibe el valor SIN guiones (ya le corresponde al llamador
 * decidir si un guion borrado con backspace cuenta como un caracter
 * borrado, ver el manejador de `onChange`) y siempre devuelve un código
 * bien formado o un prefijo parcial de uno.
 *
 * No usa `generarCodigoInvitacion`'s prefijo dinámico: en la práctica todo
 * código que se genera usa "UVA" (`src/actions/admin/codigosInvitacion.ts`
 * nunca pasa otro), así que el formato de tecleo asume 3-4-4 igual que la
 * visualización en el panel admin.
 */
export function formatearCodigoMientrasEscribe(sinGuiones: string): string {
  const limpio = sinGuiones
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, LARGO_SIN_GUIONES);

  let resultado = limpio.slice(0, 3);
  if (limpio.length > 3) resultado += `-${limpio.slice(3, 7)}`;
  if (limpio.length > 7) resultado += `-${limpio.slice(7, 11)}`;
  return resultado;
}

/**
 * Tope de días que puede otorgar un código. No lo impone la base: es un
 * freno a la equivocación de teclado (escribir 3650 en vez de 365 regala
 * diez años de acceso, y revertirlo obliga a editar la suscripción ya
 * creada). Compartido por los dos modos de generación (código único y
 * lote): la regla de negocio es la misma sin importar cuál gane la
 * decisión pendiente de rev.md.
 */
export const MAX_DURACION_DIAS = 730;

/** Valida los días de acceso que otorga un código, sea único o de lote. */
export function validarDuracionDias(duracionDias: number): string | null {
  if (!Number.isInteger(duracionDias) || duracionDias < 1) {
    return "Los días de acceso deben ser un número entero mayor que cero.";
  }
  if (duracionDias > MAX_DURACION_DIAS) {
    return `Los días de acceso no pueden superar ${MAX_DURACION_DIAS}.`;
  }
  return null;
}

/** Valida la fecha de vencimiento de un código, sea único o de lote. */
export function validarFechaVencimiento(fechaVencimiento: string): string | null {
  const vence = new Date(fechaVencimiento);
  if (Number.isNaN(vence.getTime())) return "La fecha de vencimiento no es válida.";
  if (vence.getTime() <= Date.now()) return "La fecha de vencimiento debe ser futura.";
  return null;
}

export type EstadoCodigo = "ACTIVO" | "INACTIVO" | "VENCIDO" | "AGOTADO";

/**
 * Estado real de un código, combinando sus tres formas de dejar de servir.
 * El orden importa: replica el de canjear_codigo_invitacion() (035) para
 * que el panel muestre el mismo motivo que vería quien intenta canjearlo.
 */
export function estadoCodigo(codigo: {
  activo: boolean;
  fechaVencimiento: string | Date;
  /** Siempre un entero >= 1: no existen los códigos sin tope (migración 20260827000000). */
  limiteUsos: number;
  vecesUsado: number;
}): EstadoCodigo {
  if (!codigo.activo) return "INACTIVO";

  const vence = new Date(codigo.fechaVencimiento);
  if (vence.getTime() < Date.now()) return "VENCIDO";

  if (codigo.vecesUsado >= codigo.limiteUsos) return "AGOTADO";

  return "ACTIVO";
}
