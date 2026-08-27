"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MarcarLeccionState = { error: string } | { ok: true; completado: boolean };

/**
 * Marca o desmarca una clase como completada desde el reproductor. El mockup
 * expone las dos direcciones ("Marcar clase N como completada" /
 * "Clase N completada ✓"), así que el estado se recibe explícito en vez de
 * derivarse: el botón ya sabe en qué estado está.
 *
 * RLS: la política de `progreso` acota por `id_usuario = auth.uid()`, así que
 * el upsert se hace con el cliente de sesión, nunca con service role.
 */
export async function marcarLeccion(
  leccionId: string,
  completado: boolean,
): Promise<MarcarLeccionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const { error } = await supabase
    .from("progreso")
    .upsert(
      { id_usuario: user.id, id_leccion: leccionId, completado },
      { onConflict: "id_usuario,id_leccion" },
    );

  if (error) {
    return { error: "No pudimos guardar tu progreso. Intenta de nuevo." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, completado };
}

/**
 * Registra que el estudiante empezó a ver una clase, sin marcarla completada.
 *
 * Antes solo se guardaba una fila en `progreso` cuando el estudiante hacía
 * clic en "Marcar como completada": mientras tanto, el botón del curso
 * siempre decía "Comenzar curso" y "Sigue aprendiendo" del dashboard nunca
 * se llenaba, aunque llevara varias clases vistas (Revcurso).
 *
 * `ignoreDuplicates: true` hace que sea un INSERT ... ON CONFLICT DO NOTHING:
 * si ya existe una fila para esta clase (completada o no), no se toca —
 * nunca debe pisar `completado` ni `segundo_actual` ya guardados.
 */
export async function iniciarProgresoLeccion(leccionId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("progreso")
    .upsert(
      { id_usuario: user.id, id_leccion: leccionId },
      { onConflict: "id_usuario,id_leccion", ignoreDuplicates: true },
    );

  revalidatePath("/dashboard", "layout");
}

/**
 * Guarda el segundo de reproducción actual (Revf3: guardado de progreso por
 * lección). Se llama a intervalos desde el reproductor mientras la pestaña
 * sigue activa — para el guardado al cerrar/ocultar la pestaña existe un
 * mecanismo aparte (ver src/app/api/progreso/beacon/route.ts) porque
 * `navigator.sendBeacon` no puede invocar un Server Action.
 *
 * A propósito solo toca `segundo_actual`: nunca debe pisar `completado`, así
 * que ese campo no entra en el payload del upsert. Tampoco revalida ninguna
 * ruta — se llama cada ~10s durante la reproducción y forzar una
 * revalidación en cada guardado sería un costo sin ningún beneficio visible
 * (nada en la UI muestra `segundo_actual` fuera del propio reproductor, que
 * ya lo lleva en estado local).
 *
 * Devuelve si el guardado se confirmó: el reproductor lo usa para reintentar
 * (Revf3, "tolerar el modo sin conexión... reintentar, no perder la
 * posición silenciosamente") en vez de asumir éxito y perder la posición si
 * el upsert falla por un corte de red.
 */
export async function guardarSegundoActual(
  leccionId: string,
  segundos: number,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };
  if (!Number.isFinite(segundos)) return { ok: false };

  const segundoActual = Math.max(0, Math.floor(segundos));

  const { error } = await supabase
    .from("progreso")
    .upsert(
      { id_usuario: user.id, id_leccion: leccionId, segundo_actual: segundoActual },
      { onConflict: "id_usuario,id_leccion" },
    );

  return { ok: !error };
}
