"use server";

import { getCursosParaBuscador, type CursoOpcionBuscador } from "@/lib/categoria";

export type { CursoOpcionBuscador };

/**
 * Listado liviano de cursos (id/título/instructor) para el dropdown del
 * buscador de los headers. Ver getCursosParaBuscador en src/lib/categoria.ts.
 */
export async function listarCursosParaBuscador(): Promise<CursoOpcionBuscador[]> {
  return getCursosParaBuscador();
}
