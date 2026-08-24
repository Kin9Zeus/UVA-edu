/**
 * Convenciones de `orden`: enteros espaciados de 10 en 10 (nunca
 * consecutivos), para poder insertar/mover un elemento calculando un
 * valor intermedio sin reescribir el resto de filas. Ver auditoría de
 * esquema (Bloque 2).
 */
export const ESPACIO_ORDEN = 10;

export function siguienteOrden(ultimoOrden: number | null): number {
  return (ultimoOrden ?? 0) + ESPACIO_ORDEN;
}

/**
 * Valor de `orden` para insertar un elemento entre dos vecinos, sin
 * tocar el resto. Devuelve null si no queda espacio entre ellos (hace
 * falta reespaciar el grupo completo).
 */
export function ordenEntre(anterior: number | null, siguiente: number | null): number | null {
  if (anterior === null && siguiente === null) return ESPACIO_ORDEN;

  const base = anterior ?? 0;
  if (siguiente === null) return base + ESPACIO_ORDEN;

  const medio = Math.floor((base + siguiente) / 2);
  return medio > base && medio < siguiente ? medio : null;
}
