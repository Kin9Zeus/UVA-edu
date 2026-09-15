import { z } from "zod";

/**
 * Esquemas de validación de calificaciones de curso — módulo aparte (no
 * dentro de actions/cursos/calificaciones.ts) por el mismo motivo que
 * comunidad-validacion.ts: un archivo "use server" solo puede exportar
 * funciones async.
 */
export const puntuacionSchema = z
  .number()
  .int("La calificación debe ser un número entero.")
  .min(1, "La calificación mínima es 1 estrella.")
  .max(5, "La calificación máxima es 5 estrellas.");

export const comentarioCalificacionSchema = z
  .string()
  .trim()
  .max(1000, "El comentario es demasiado largo.")
  .optional();
