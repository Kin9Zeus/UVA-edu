import type { SupabaseClient } from "@supabase/supabase-js";
import { mux } from "@/lib/mux/client";
import { obtenerAccesoAlCurso } from "@/lib/accesoCurso";
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
 * (`obtenerAccesoAlCurso`, única función que decide el muro — ver
 * src/lib/accesoCurso.ts) — sin eso una URL "signed" no protege nada
 * distinto de una "public" (docs/technical-spec.md §5, error a evitar
 * explícitamente pedido en la tarea).
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

  // Vista previa pública (Revcurso: "primera lección visible"): la clase
  // introductoria del curso —la de menor `orden` en el módulo de menor
  // `orden`— se reproduce sin sesión ni acceso vigente. Cualquier otra
  // lección sigue exigiendo ambos, exactamente como antes.
  if (await esLeccionIntroductoria(supabase, leccionId, cursoId)) {
    return firmarPlaybackToken(leccion.id_video_mux, leccionId);
  }

  if (!user) return { error: "Debes iniciar sesión para ver este video." };

  const [{ data: perfil }, acceso] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    obtenerAccesoAlCurso(supabase, user.id, cursoId),
  ]);

  const esAdmin = perfil?.rol === "ADMINISTRADOR";
  if (!esAdmin && !acceso.tieneAcceso) {
    return { error: "No tienes acceso vigente a este curso." };
  }

  return firmarPlaybackToken(leccion.id_video_mux, leccionId);
}

async function firmarPlaybackToken(
  playbackId: string,
  leccionId: string,
): Promise<TokenReproduccionResultado> {
  try {
    const token = await mux.jwt.signPlaybackId(playbackId, {
      type: "video",
      expiration: DURACION_TOKEN,
    });
    return { playbackId, token };
  } catch (error) {
    logError("video:reproduccion", "no se pudo firmar el playback token", error, {
      area: "webhook",
      leccionId,
    });
    return { error: "No pudimos preparar la reproducción." };
  }
}

/**
 * La lección introductoria es la de menor `orden` dentro del módulo de
 * menor `orden` del curso — misma noción posicional que `primeraLeccionId`
 * en CursoDetalleContent.tsx, no un flag guardado por lección.
 *
 * Exige AL MENOS DOS lecciones en el curso: un curso de una sola clase no
 * tiene "introducción" separada del contenido pagado — esa única lección
 * ES el curso completo, y tratarla como vista previa pública abriría el
 * candado por completo (lo detectó test:rls: con esta guarda ausente, un
 * curso de una sola lección quedaba reproducible por cualquiera, sin
 * sesión ni acceso).
 */
async function esLeccionIntroductoria(
  supabase: SupabaseClient,
  leccionId: string,
  cursoId: string,
): Promise<boolean> {
  const { data: modulos } = await supabase
    .from("modulos")
    .select("id, orden, lecciones(id, orden)")
    .eq("id_curso", cursoId)
    .order("orden");

  const plano = (modulos ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .flatMap((modulo) =>
      (modulo.lecciones ?? []).slice().sort((a, b) => a.orden - b.orden),
    );

  if (plano.length < 2) return false;
  return plano[0]?.id === leccionId;
}
