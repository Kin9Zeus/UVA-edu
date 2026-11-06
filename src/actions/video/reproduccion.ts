"use server";

import { createClient } from "@/lib/supabase/server";
import { registrarSiFalla } from "@/lib/supabase/registrar";
import { resolverTokenReproduccion, type TokenReproduccionResultado } from "@/lib/video/reproduccion";
import {
  MENSAJE_OTRO_DISPOSITIVO,
  reclamarReproduccion,
  reproduccionVigente,
} from "@/lib/video/reproduccionUnica";

/**
 * `sesion`: token de "un video a la vez por cuenta" (Flujo 05). Null para
 * administradores o sin sesión. `otroDispositivo`: otro equipo reclamó.
 */
export type TokenReproduccionConSesion =
  | (Extract<TokenReproduccionResultado, { error: string }> & { otroDispositivo?: true })
  | (Extract<TokenReproduccionResultado, { token: string }> & {
      sesion: string | null;
      /** Al reclamar: último segundo guardado de la clase (otro equipo pudo avanzar). */
      segundoGuardado?: number | null;
    });

/**
 * Genera el token firmado para reproducir el video de una lección.
 *
 * La lógica del muro de acceso vive en `resolverTokenReproduccion()`
 * (src/lib/video/reproduccion.ts), separada para poder probarla con un
 * cliente autenticado a mano (scripts/rls-test.ts): `createClient()` lee
 * `cookies()` y solo existe dentro de una petición de Next.
 *
 * Además lleva el límite de un video a la vez (Flujo 05): sin `sesion`, el
 * reproductor está arrancando (o el estudiante tocó "Ver aquí") y reclama la
 * reproducción para este equipo; con `sesion`, es una renovación y solo se
 * firma si este equipo sigue siendo el vigente.
 */
export async function obtenerTokenReproduccion(
  leccionId: string,
  sesion: string | null = null,
): Promise<TokenReproduccionConSesion> {
  const supabase = await createClient();

  if (sesion && !(await reproduccionVigente(supabase, sesion))) {
    return { error: MENSAJE_OTRO_DISPOSITIVO, otroDispositivo: true };
  }

  const resultado = await resolverTokenReproduccion(supabase, leccionId);
  if ("error" in resultado) return resultado;
  if (sesion) return { ...resultado, sesion };

  // La clase introductoria se ve sin cuenta: ahí no hay nada que reclamar.
  const { data: claims } = await supabase.auth.getClaims();
  const usuarioId = claims?.claims?.sub;
  if (!usuarioId) return { ...resultado, sesion: null };

  // Al reclamar (también con «Ver aquí») se devuelve el avance guardado: si
  // otro equipo vio la MISMA clase más adelante, este sigue desde ahí en vez
  // de retroceder el avance con su posición vieja. Dato secundario: si falla,
  // el reproductor sigue desde su propia posición.
  const [nueva, { data: progreso, error }] = await Promise.all([
    reclamarReproduccion(supabase),
    supabase
      .from("progreso")
      .select("segundo_actual")
      .eq("id_usuario", usuarioId)
      .eq("id_leccion", leccionId)
      .maybeSingle(),
  ]);
  registrarSiFalla(error, "video:reproduccion", "no se pudo leer el avance al reclamar", { leccionId });
  return { ...resultado, sesion: nueva, segundoGuardado: progreso?.segundo_actual ?? null };
}
