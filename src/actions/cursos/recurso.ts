"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_MATERIALES = "materiales-lecciones";
// Solo tiene que sobrevivir el click: el navegador abre la URL de
// inmediato. Más corto que el token de reproducción de Mux (4h) a
// propósito — ese vive en memoria del reproductor mientras dura la clase,
// esto es un enlace de un solo uso que no debería reutilizarse.
const DURACION_URL_SEGUNDOS = 300;

export type UrlRecursoResultado = { error: string } | { url: string };

/**
 * Genera una URL firmada de corta duración para descargar un material de
 * lección (P1-1, AUDIT-2026-08-26.md).
 *
 * El bucket `materiales-lecciones` es privado y sus tres policies de
 * Storage son admin-only (011_bucket_materiales_lecciones.sql) — ningún
 * estudiante puede leerlo directo, ni firmando con su propio cliente. Por
 * eso la autorización va en dos pasos que no se pueden colapsar en uno:
 *
 *   1. Leer la fila con el CLIENTE DE SESIÓN. La policy
 *      `recursos_select_con_acceso` (030_acceso_curso_despublicado.sql) es
 *      la que de verdad decide si este usuario puede ver este recurso —
 *      la misma regla que ya protege el temario y el video de la lección.
 *      Si RLS no devuelve la fila, no hay nada que firmar.
 *   2. Solo con esa fila ya confirmada, usar el cliente de Service Role
 *      ÚNICAMENTE para firmar la ruta que esa fila trajo — nunca para leer
 *      ni listar el bucket a partir de un id que venga del cliente. El
 *      cliente de admin no decide autorización acá, solo tiene el permiso
 *      de Storage que un estudiante no tiene.
 */
export async function obtenerUrlRecurso(recursoId: string): Promise<UrlRecursoResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para descargar este material." };

  const { data: recurso } = await supabase
    .from("recursos_descargables")
    .select("nombre, url_archivo")
    .eq("id", recursoId)
    .maybeSingle();

  if (!recurso) return { error: "No tienes acceso a este material." };

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET_MATERIALES)
    .createSignedUrl(recurso.url_archivo, DURACION_URL_SEGUNDOS, { download: recurso.nombre });

  if (error || !data) return { error: "No pudimos generar el enlace de descarga." };

  return { url: data.signedUrl };
}
