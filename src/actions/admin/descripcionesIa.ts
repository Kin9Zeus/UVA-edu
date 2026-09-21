"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { logError } from "@/lib/log";
import {
  GeneracionDescripcionError,
  generarContenidoLeccion,
  generarDescripcionCurso,
} from "@/lib/descripciones-ia/generar";
import type { DocumentoContenido } from "@/lib/editor/tipos";

/**
 * Botones "Generar con IA" del panel de cursos. Devuelven una PROPUESTA: el
 * panel la carga en el campo sin guardar y el administrador decide si la
 * guarda con el botón de siempre (actualizarLeccion / actualizarInfoCurso,
 * que son los que validan, escriben y registran en la bitácora).
 */

const idSchema = z.string().uuid();

const ERROR_GENERICO = "No pudimos generar el texto con IA. Intenta de nuevo en un momento.";

function mensajeDeError(error: unknown, scope: string, contexto: Record<string, unknown>): string {
  if (error instanceof GeneracionDescripcionError) return error.message;
  logError(scope, "falló la generación con IA", error, { area: "descripciones-ia", ...contexto });
  return ERROR_GENERICO;
}

export async function generarContenidoLeccionConIa(
  leccionId: string,
  cursoId: string,
): Promise<{ error?: string; contenido?: DocumentoContenido }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(leccionId).success || !idSchema.safeParse(cursoId).success) {
    return { error: "Lección inválida." };
  }

  try {
    return { contenido: await generarContenidoLeccion(leccionId, cursoId) };
  } catch (error) {
    return { error: mensajeDeError(error, "descripciones-ia:leccion", { leccionId, cursoId }) };
  }
}

export async function generarDescripcionCursoConIa(
  cursoId: string,
): Promise<{ error?: string; descripcion?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(cursoId).success) return { error: "Curso inválido." };

  try {
    return { descripcion: await generarDescripcionCurso(cursoId) };
  } catch (error) {
    return { error: mensajeDeError(error, "descripciones-ia:curso", { cursoId }) };
  }
}
