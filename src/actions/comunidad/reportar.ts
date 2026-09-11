"use server";

import { createClient } from "@/lib/supabase/server";

export type ReportarComunidadResultado = { error: string } | { success: true };

/**
 * Denuncia un post o una respuesta ajenos — nunca cambia nada visible del
 * contenido reportado, solo alimenta la cola de /admin/comunidad
 * (getReportesComunidadPendientes). RLS (090_comunidad_reportes.sql) ya
 * impide reportar contenido propio y reportar dos veces lo mismo; acá se
 * traducen esos rechazos a mensajes legibles en vez de dejar pasar el error
 * crudo de Postgres.
 */
export async function reportarComunidad(
  objetivo: { idPost: string } | { idRespuesta: string },
  motivo: string,
): Promise<ReportarComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const motivoLimpio = motivo.trim();
  if (!motivoLimpio) return { error: "Escribe el motivo del reporte." };

  const { error } = await supabase.from("comunidad_reportes").insert({
    id_post: "idPost" in objetivo ? objetivo.idPost : null,
    id_respuesta: "idRespuesta" in objetivo ? objetivo.idRespuesta : null,
    id_reportante: user.id,
    motivo: motivoLimpio,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ya reportaste esto." };
    // RLS rechaza reportar tu propio contenido (comunidad_reportes_insert_propio):
    // llega como violación de policy, no como un código específico.
    if (error.code === "42501") return { error: "No puedes reportar tu propia publicación." };
    return { error: "No pudimos enviar el reporte." };
  }

  return { success: true };
}
