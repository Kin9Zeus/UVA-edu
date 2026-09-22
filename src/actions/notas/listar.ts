"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";
import { leerNotasDeLecciones, type NotaLeccion } from "@/lib/notas";

export type ListarNotasDelCursoResultado = { error: string } | { success: true; notas: NotaLeccion[] };

// Un curso real tiene decenas de clases; el techo solo evita que una
// llamada directa a la acción arme un `IN (...)` gigante.
const leccionIdsSchema = z.array(z.string().uuid()).min(1).max(500);

/**
 * Notas del usuario en todas las clases de un curso, para el selector
 * "Todo el curso" de la pestaña Notas (docs/notas-leccion.md §6.1).
 *
 * Recibe los ids de lección que el reproductor ya tiene (`data.lecciones`)
 * en vez del id del curso: evita volver a consultar módulos y lecciones.
 * No abre nada nuevo — RLS devuelve solo las notas propias, pase lo que
 * pase en la lista.
 */
export async function listarNotasDelCurso(leccionIds: string[]): Promise<ListarNotasDelCursoResultado> {
  const user = await getUsuarioActual();
  if (!user) return { error: "Debes iniciar sesión." };

  const parseo = leccionIdsSchema.safeParse(leccionIds);
  if (!parseo.success) return { error: "Curso inválido." };

  const notas = await leerNotasDeLecciones(await createClient(), parseo.data, user.id);
  return { success: true, notas };
}
