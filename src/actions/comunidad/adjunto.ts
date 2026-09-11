"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_ADJUNTOS_COMUNIDAD } from "@/lib/comunidad-adjuntos";

// Solo tiene que sobrevivir el click — mismo criterio y misma duración que
// obtenerUrlRecurso (src/actions/cursos/recurso.ts).
const DURACION_URL_SEGUNDOS = 300;

export type UrlAdjuntoComunidadResultado = { error: string } | { url: string };

/**
 * URL firmada de un solo uso para descargar un adjunto que NO es imagen
 * (las imágenes ya se sirven firmadas desde el feed, ver enriquecer() en
 * src/lib/comunidad.ts — esto es solo para el botón "Descargar" de un
 * documento).
 *
 * Mismo patrón en dos pasos que obtenerUrlRecurso: el bucket
 * `comunidad-adjuntos` no tiene ninguna policy de SELECT en Storage
 * (086_comunidad_adjuntos.sql) — la única fuente de autorización es esta
 * fila de `comunidad_adjuntos`, protegida por RLS con el mismo criterio
 * que el post/respuesta al que pertenece. Solo después de leerla con el
 * cliente de sesión se usa el de Service Role, únicamente para firmar la
 * ruta que esa fila ya trajo.
 */
export async function obtenerUrlAdjuntoComunidad(adjuntoId: string): Promise<UrlAdjuntoComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para descargar este archivo." };

  const { data: adjunto } = await supabase
    .from("comunidad_adjuntos")
    .select("ruta_storage, nombre_original")
    .eq("id", adjuntoId)
    .maybeSingle();
  if (!adjunto) return { error: "No tienes acceso a este archivo." };

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET_ADJUNTOS_COMUNIDAD)
    .createSignedUrl(adjunto.ruta_storage, DURACION_URL_SEGUNDOS, { download: adjunto.nombre_original });

  if (error || !data) return { error: "No pudimos generar el enlace de descarga." };

  return { url: data.signedUrl };
}
