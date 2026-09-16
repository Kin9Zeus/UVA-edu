"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { puntuacionSchema, comentarioCalificacionSchema } from "@/lib/curso-calificaciones-validacion";

export type CalificacionCursoResultado = { error: string } | { success: true };

/**
 * Lo que se revalida tras cualquier cambio de reseñas: la ficha de curso,
 * como PATRÓN de ruta (todas las fichas) y no la URL concreta.
 *
 * Antes cada acción recibía `ruta` como argumento y la pasaba tal cual a
 * `revalidatePath`. Una Server Action es un endpoint público: cualquiera con
 * sesión podía llamarla con la ruta que quisiera e invalidar la caché de
 * otras páginas del sitio. Las reseñas solo se ven en
 * `(public)/cursos/[cursoSlug]` (CursoDetalleContent), así que la ruta la
 * decide el servidor. Se usa el patrón porque las acciones que reciben un
 * id de reseña no conocen el slug, y buscarlo costaría una consulta por
 * clic; la ficha lee la sesión en cada petición (no hay caché de datos que
 * perder), así que invalidar todas no le cuesta nada a nadie.
 */
function revalidarFichasDeCurso() {
  revalidatePath("/cursos/[cursoSlug]", "page");
}

/**
 * Crea o edita la reseña propia de un curso (estrellas 1-5 + comentario
 * opcional) — una fila por (curso, usuario), mismo criterio que "una
 * calificación editable" de Platzi. No se usa `upsert`: el índice único que
 * lo garantiza es PARCIAL (`where not eliminado`, 102_curso_calificaciones.sql,
 * mismo motivo que comunidad_reacciones) y PostgREST no puede inferir un
 * índice de conflicto parcial a partir de una lista de columnas — se busca
 * la fila propia activa a mano y se decide INSERT o UPDATE.
 */
export async function calificarCurso(
  cursoId: string,
  puntuacion: number,
  comentario: string,
): Promise<CalificacionCursoResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const parseoPuntuacion = puntuacionSchema.safeParse(puntuacion);
  if (!parseoPuntuacion.success) {
    return { error: parseoPuntuacion.error.issues[0]?.message ?? "Calificación inválida." };
  }
  const parseoComentario = comentarioCalificacionSchema.safeParse(comentario);
  if (!parseoComentario.success) {
    return { error: parseoComentario.error.issues[0]?.message ?? "Comentario inválido." };
  }
  const comentarioLimpio = parseoComentario.data || null;

  const { data: existente } = await supabase
    .from("curso_calificaciones")
    .select("id")
    .eq("id_curso", cursoId)
    .eq("id_usuario", user.id)
    .eq("eliminado", false)
    .maybeSingle();

  const { error } = existente
    ? await supabase
        .from("curso_calificaciones")
        .update({ puntuacion: parseoPuntuacion.data, comentario: comentarioLimpio })
        .eq("id", existente.id)
    : await supabase.from("curso_calificaciones").insert({
        id_curso: cursoId,
        id_usuario: user.id,
        puntuacion: parseoPuntuacion.data,
        comentario: comentarioLimpio,
      });

  // El caso más común de error acá es RLS rechazando el INSERT porque el
  // usuario no tiene acceso vigente al curso (private.tiene_acceso_vigente_curso)
  // — la UI ya oculta el formulario sin acceso (CursoDetalleContent solo lo
  // renderiza si curso.tieneAcceso), así que llegar hasta acá sin acceso
  // solo pasa si el acceso venció justo entre cargar la página y enviar.
  if (error) return { error: "No pudimos guardar tu calificación. Verifica que tengas acceso vigente al curso." };

  revalidarFichasDeCurso();
  return { success: true };
}

/**
 * Elimina la reseña propia — un clic, sin motivo (mismo criterio que
 * eliminarPostComunidad cuando el autor borra la suya).
 */
export async function eliminarCalificacionPropia(
  calificacionId: string,
): Promise<CalificacionCursoResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  // `.select("id")` para saber cuántas filas cambiaron: un UPDATE que no
  // coincide con nada (id ajeno, o que RLS filtró) no es un error para
  // PostgREST, y sin esto la acción respondía éxito sin haber borrado nada.
  // No agrega ninguna exigencia nueva de RLS: Postgres ya aplica la policy de
  // SELECT a la fila resultante de todo UPDATE con WHERE (ver el comentario
  // de curso_calificaciones_select_publico, 102_curso_calificaciones.sql).
  const { data: eliminadas, error } = await supabase
    .from("curso_calificaciones")
    .update({ eliminado: true })
    .eq("id", calificacionId)
    .eq("id_usuario", user.id)
    .select("id");

  if (error) return { error: "No pudimos eliminar tu calificación." };
  if (!eliminadas?.length) return { error: "No encontramos tu calificación. Recarga la página." };
  revalidarFichasDeCurso();
  return { success: true };
}

/**
 * Modera (oculta) la reseña de otra persona — solo ADMINISTRADOR, verificado
 * acá además de en RLS (curso_calificaciones_transiciones_permitidas,
 * 102_curso_calificaciones.sql: exige que `id_eliminado_por` sea el propio
 * admin que firma). Sin motivo obligatorio ni correo al autor — a diferencia
 * de moderar en Comunidad, esto es contenido de marketing público, no un
 * hilo de conversación; queda igual registrado en la bitácora administrativa.
 */
export async function moderarCalificacion(
  calificacionId: string,
): Promise<CalificacionCursoResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "ADMINISTRADOR") return { error: "No tienes permiso para moderar reseñas." };

  // Mismo motivo que en eliminarCalificacionPropia, y aquí pesa más: sin
  // contar filas, un id inexistente quedaba en la bitácora como una
  // moderación que nunca ocurrió.
  const { data: moderadas, error } = await supabase
    .from("curso_calificaciones")
    .update({ eliminado: true, eliminado_por_admin: true, id_eliminado_por: user.id })
    .eq("id", calificacionId)
    .select("id");

  if (error) return { error: "No pudimos eliminar la reseña." };
  if (!moderadas?.length) return { error: "Esa reseña ya no existe." };

  await registrarBitacora(supabase, {
    idAdmin: user.id,
    accion: "Eliminó una reseña de curso (moderación)",
    entidadAfectada: "curso_calificaciones",
    idEntidadAfectada: calificacionId,
  });

  revalidarFichasDeCurso();
  return { success: true };
}

/** Reacciona o quita la reacción ("me gusta") a una reseña. Sí usa `upsert`
 * (a diferencia de calificarCurso): la unicidad de curso_calificacion_reacciones
 * es un `@@unique` normal, sin predicado — mismo patrón que darLikeComentario
 * (src/actions/comentarios/like.ts). */
export async function reaccionarCalificacion(
  calificacionId: string,
): Promise<CalificacionCursoResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("curso_calificacion_reacciones")
    .upsert(
      { id_calificacion: calificacionId, id_usuario: user.id },
      { onConflict: "id_calificacion,id_usuario", ignoreDuplicates: true },
    );

  if (error) return { error: "No pudimos guardar tu reacción." };
  revalidarFichasDeCurso();
  return { success: true };
}

export async function quitarReaccionCalificacion(
  calificacionId: string,
): Promise<CalificacionCursoResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { error } = await supabase
    .from("curso_calificacion_reacciones")
    .delete()
    .eq("id_calificacion", calificacionId)
    .eq("id_usuario", user.id);

  if (error) return { error: "No pudimos quitar tu reacción." };
  revalidarFichasDeCurso();
  return { success: true };
}
