import { z } from "zod";

/**
 * Esquemas de validación de Comunidad, compartidos entre crear.ts y
 * editar.ts (src/actions/comunidad/) — separados de esos archivos a
 * propósito: un módulo "use server" solo puede exportar funciones async
 * (Next.js lo exige), así que un `export const tituloSchema = z...` ahí
 * revienta en runtime con "A 'use server' file can only export async
 * functions, found object" en cuanto algo más lo importa. Mismo motivo por
 * el que comunidad-tipos.ts vive aparte de comunidad.ts.
 */
export const tituloSchema = z
  .string()
  .trim()
  .min(3, "El título es demasiado corto.")
  .max(150, "El título es demasiado largo.");

export const contenidoPostSchema = z
  .string()
  .trim()
  .min(1, "Escribe algo antes de publicar.")
  .max(5000, "La publicación es demasiado larga.");

export const contenidoRespuestaSchema = z
  .string()
  .trim()
  .min(1, "Escribe algo antes de responder.")
  .max(2000, "La respuesta es demasiado larga.");
