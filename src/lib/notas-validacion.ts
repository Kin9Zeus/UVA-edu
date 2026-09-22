import { z } from "zod";

/**
 * Esquemas y utilidades puras de "Mis notas" (docs/notas-leccion.md) —
 * módulo aparte de las Server Actions por el mismo motivo que
 * comunidad-validacion.ts: un archivo "use server" solo puede exportar
 * funciones async, y el formateo del tiempo también lo usa el cliente.
 *
 * Los topes repiten los CHECK de supabase/sql/115_notas_leccion.sql: esta
 * es la capa que da un mensaje claro, aquella la que no se puede saltar.
 */
export const MAX_CARACTERES_NOTA = 2000;
/** Un día: el mismo techo que el CHECK de la base. Ningún video real llega. */
export const MAX_SEGUNDO_NOTA = 86_400;
/** Mismo tope que el trigger de 115. */
export const MAX_NOTAS_POR_LECCION = 200;

export const idSchema = z.string().uuid("Identificador inválido.");

export const segundoNotaSchema = z
  .number()
  .int("El minuto de la nota no es válido.")
  .min(0, "El minuto de la nota no es válido.")
  .max(MAX_SEGUNDO_NOTA, "El minuto de la nota no es válido.");

export const contenidoNotaSchema = z
  .string()
  .trim()
  .min(1, "Escribe algo antes de guardar la nota.")
  .max(MAX_CARACTERES_NOTA, "La nota es demasiado larga.");

/**
 * Lee el parámetro `?t=` con el que una nota enlaza a su minuto desde otra
 * clase o desde "Mis notas". Solo acepta un entero dentro del rango del
 * CHECK de la base; cualquier otra cosa se ignora (null) y la clase
 * retoma donde el estudiante la dejó, como siempre.
 */
export function parsearSegundoEnUrl(valor: string | string[] | undefined): number | null {
  if (typeof valor !== "string" || !/^\d{1,6}$/.test(valor)) return null;
  const segundo = Number(valor);
  return segundo <= MAX_SEGUNDO_NOTA ? segundo : null;
}

/** 204 → "03:24"; 3725 → "1:02:05". Negativos y no enteros se normalizan. */
export function formatearTiempoNota(segundos: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segs = total % 60;
  const dos = (n: number) => String(n).padStart(2, "0");
  return horas > 0 ? `${horas}:${dos(minutos)}:${dos(segs)}` : `${dos(minutos)}:${dos(segs)}`;
}

/** Valor para `<time dateTime>`: duración ISO 8601 (204 → "PT3M24S"). */
export function duracionIsoNota(segundos: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segs = total % 60;
  return `PT${horas ? `${horas}H` : ""}${minutos ? `${minutos}M` : ""}${segs || total === 0 ? `${segs}S` : ""}`;
}
