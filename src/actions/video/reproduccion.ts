"use server";

import { createClient } from "@/lib/supabase/server";
import { mux } from "@/lib/mux/client";
import { tieneAccesoVigente } from "@/lib/mux/acceso";
import { logError } from "@/lib/log";

// Vida corta a propósito (CLAUDE.md §3.2/§3.3, docs/technical-spec.md §5):
// el token nunca se persiste, el reproductor pide uno nuevo cada vez que
// monta. Unas horas evita que una sesión de estudio larga se corte a media
// clase sin abrir la puerta a un enlace reutilizable días después.
const DURACION_TOKEN = "4h";

export type TokenReproduccionResultado = { error: string } | { playbackId: string; token: string };

/**
 * Genera el token firmado para reproducir el video de una lección. Valida
 * ANTES de firmar que el usuario autenticado tiene acceso vigente
 * (Suscripción activa/past_due, o Inscripción al curso) — sin eso una URL
 * "signed" no protege nada distinto de una "public" (docs/technical-spec.md
 * §5, error a evitar explícitamente pedido en la tarea).
 *
 * Los administradores pueden previsualizar cualquier lección sin
 * Suscripción/Inscripción propia: lo necesita el panel admin para mostrar
 * el video recién subido, y es la misma noción de "administrador" que ya
 * usa el resto del CMS (private.es_administrador() en RLS).
 */
export async function obtenerTokenReproduccion(leccionId: string): Promise<TokenReproduccionResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesión para ver este video." };

  const { data: leccion } = await supabase
    .from("lecciones")
    .select("id_video_mux, estado_procesamiento, modulo:modulos(id_curso)")
    .eq("id", leccionId)
    .maybeSingle();

  if (!leccion || !leccion.id_video_mux || leccion.estado_procesamiento !== "LISTO") {
    return { error: "El video todavía no está disponible." };
  }

  const modulo = Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo;
  const cursoId = modulo?.id_curso;
  if (!cursoId) return { error: "El video todavía no está disponible." };

  const [{ data: perfil }, { data: suscripcion }, { data: inscripcion }] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    supabase
      .from("suscripciones")
      .select("estado")
      .eq("id_usuario", user.id)
      .in("estado", ["ACTIVA", "PAST_DUE"])
      .limit(1)
      .maybeSingle(),
    supabase
      .from("inscripciones")
      .select("id")
      .eq("id_usuario", user.id)
      .eq("id_curso", cursoId)
      .limit(1)
      .maybeSingle(),
  ]);

  const esAdmin = perfil?.rol === "ADMINISTRADOR";
  if (!esAdmin && !tieneAccesoVigente(suscripcion, inscripcion !== null)) {
    return { error: "No tienes acceso vigente a este curso." };
  }

  try {
    const token = await mux.jwt.signPlaybackId(leccion.id_video_mux, {
      type: "video",
      expiration: DURACION_TOKEN,
    });
    return { playbackId: leccion.id_video_mux, token };
  } catch (error) {
    logError("video:reproduccion", "no se pudo firmar el playback token", error, {
      area: "webhook",
      leccionId,
    });
    return { error: "No pudimos preparar la reproducción." };
  }
}
