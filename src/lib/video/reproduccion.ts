import type { SupabaseClient } from "@supabase/supabase-js";
import { mux } from "@/lib/mux/client";
import { tieneAccesoVigente } from "@/lib/mux/acceso";
import { logError } from "@/lib/log";

// Vida corta a propósito (CLAUDE.md §3.2/§3.3, docs/technical-spec.md §5,
// tarea "Reproductor Mux con URL firmada"): un token capturado de la red
// debe dejar de funcionar en minutos, no horas. El reproductor (VideoPlayer)
// pide uno nuevo antes de que este expire, así que una sesión de estudio
// larga no se corta — la vida corta no depende de que el estudiante no se
// quede viendo una clase larga.
const DURACION_TOKEN = "15m";

export type TokenReproduccionResultado = { error: string } | { playbackId: string; token: string };

/**
 * Lógica real del muro de acceso al video, separada de
 * `src/actions/video/reproduccion.ts` para poder probarla directamente.
 *
 * `obtenerTokenReproduccion()` (el Server Action) es apenas un envoltorio:
 * arma un `SupabaseClient` con `createClient()` de `@/lib/supabase/server`
 * (que depende de `cookies()` de `next/headers`, solo disponible dentro de
 * una petición real de Next) y delega aquí. Esta función, en cambio, recibe
 * el cliente ya construido — puede ser el de una petición real, o uno de
 * `@supabase/supabase-js` autenticado a mano con `signInWithPassword`, como
 * hace `scripts/rls-test.ts` con sus tres cuentas de prueba (sin acceso, con
 * acceso vigente, con acceso vencido). Es lo que permite que RevAccesof4.md
 * — "probado llamando la API directamente, no solo desde la interfaz" — se
 * cumpla también para la reproducción, no solo para RLS.
 *
 * Valida ANTES de firmar que el usuario autenticado tiene acceso vigente
 * (`tieneAccesoVigente`, única regla del muro) — sin eso una URL "signed" no
 * protege nada distinto de una "public" (docs/technical-spec.md §5, error a
 * evitar explícitamente pedido en la tarea).
 *
 * Los administradores pueden previsualizar cualquier lección sin
 * Suscripción/Inscripción propia: lo necesita el panel admin para mostrar
 * el video recién subido, y es la misma noción de "administrador" que ya
 * usa el resto del CMS (private.es_administrador() en RLS).
 */
export async function resolverTokenReproduccion(
  supabase: SupabaseClient,
  leccionId: string,
): Promise<TokenReproduccionResultado> {
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
    // Se pide la última suscripción sin filtrar por estado: la vigencia la
    // decide `tieneAccesoVigente`, que además de ACTIVA/PAST_DUE mira la
    // fecha. Filtrar aquí por estado escondía justo el caso que hay que
    // detectar — una ACTIVA con el periodo ya terminado.
    supabase
      .from("suscripciones")
      .select("estado, fecha_renovacion")
      .eq("id_usuario", user.id)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Solo CORTESIA activa: una MEMBRESIA es el registro de haber entrado
    // bajo una suscripción, no un permiso que la sobreviva (ver
    // mux/acceso.ts); una CORTESIA revocada (f4accesos.md) tampoco cuenta
    // — la fila se conserva marcada `activo = false`, no se borra.
    supabase
      .from("inscripciones")
      .select("id")
      .eq("id_usuario", user.id)
      .eq("id_curso", cursoId)
      .eq("tipo_acceso", "CORTESIA")
      .eq("activo", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const esAdmin = perfil?.rol === "ADMINISTRADOR";
  if (
    !esAdmin &&
    !tieneAccesoVigente(
      suscripcion && {
        estado: suscripcion.estado,
        fechaRenovacion: suscripcion.fecha_renovacion,
      },
      inscripcion !== null,
    )
  ) {
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
