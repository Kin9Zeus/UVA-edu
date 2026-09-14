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

/** Los 4 de abajo son exclusivos de la categoría EMPLEO (crear.ts/editar.ts
 * los exige solo ahí) — mismo CHECK reflejado en la base
 * (110_comunidad_empleo_campos.sql), esto solo mejora el mensaje. */
export const empleoEmpresaSchema = z
  .string()
  .trim()
  .min(1, "Escribe el nombre de la empresa.")
  .max(120, "El nombre de la empresa es demasiado largo.");

export const EMPLEO_MODALIDADES = ["PRESENCIAL", "REMOTO", "HIBRIDO"] as const;
export type EmpleoModalidad = (typeof EMPLEO_MODALIDADES)[number];
export const empleoModalidadSchema = z.enum(EMPLEO_MODALIDADES, { message: "Selecciona una modalidad." });

export const empleoUbicacionSchema = z.string().trim().max(120, "La ubicación es demasiado larga.").optional();

export const empleoEnlaceSchema = z
  .string()
  .trim()
  .url("Ingresa un enlace válido (debe empezar con http:// o https://).")
  .max(500, "El enlace es demasiado largo.");
