import { createClient } from "@/lib/supabase/server";
import { tiempoRelativo } from "@/lib/admin/format";

export type CalificacionCurso = {
  id: string;
  autorId: string;
  autorNombre: string;
  autorFotoUrl: string | null;
  puntuacion: number;
  comentario: string | null;
  tiempo: string;
  totalMeGusta: number;
  meGusta: boolean;
};

export type CalificacionesCurso = {
  promedio: number | null;
  total: number;
  reseñas: CalificacionCurso[];
  /** La reseña propia del usuario actual, si ya calificó — `null` también
   * para un visitante sin sesión. El composer la usa para precargar el
   * formulario en modo edición en vez de dejarlo crear una segunda. */
  miCalificacion: CalificacionCurso | null;
};

/**
 * Reseñas públicas de un curso (estrellas + comentario opcional) — visibles
 * sin sesión, a diferencia de Comunidad: el catálogo ya es público
 * (CursoDetalleContent con basePath="/catalogo"). `curso_calificaciones_resumen`
 * y `curso_calificacion_autor_publico` (102_curso_calificaciones.sql)
 * resuelven el promedio y el nombre del autor sin exponer `perfiles` directo.
 */
export async function getCalificacionesCurso(
  cursoId: string,
  usuarioId: string | null,
): Promise<CalificacionesCurso> {
  const supabase = await createClient();

  const [{ data: resumen }, { data: filas }] = await Promise.all([
    supabase.from("curso_calificaciones_resumen").select("promedio, total").eq("id_curso", cursoId).maybeSingle(),
    supabase
      .from("curso_calificaciones")
      .select("id, id_usuario, puntuacion, comentario, creado_en")
      .eq("id_curso", cursoId)
      .eq("eliminado", false)
      .order("creado_en", { ascending: false }),
  ]);

  const reseñasBase = filas ?? [];
  const idsAutores = [...new Set(reseñasBase.map((fila) => fila.id_usuario as string))];
  const idsCalificaciones = reseñasBase.map((fila) => fila.id as string);

  const [{ data: autores }, { data: reacciones }] = await Promise.all([
    idsAutores.length
      ? supabase.from("curso_calificacion_autor_publico").select("id, nombre, foto_url").in("id", idsAutores)
      : Promise.resolve({ data: [] as { id: string; nombre: string; foto_url: string | null }[] }),
    idsCalificaciones.length
      ? supabase.from("curso_calificacion_reacciones").select("id_calificacion, id_usuario").in("id_calificacion", idsCalificaciones)
      : Promise.resolve({ data: [] as { id_calificacion: string; id_usuario: string }[] }),
  ]);

  const nombrePorAutorId = new Map((autores ?? []).map((a) => [a.id, a.nombre]));
  const fotoPorAutorId = new Map((autores ?? []).map((a) => [a.id, a.foto_url]));
  const totalMeGustaPorId = new Map<string, number>();
  const meGustaDelUsuario = new Set<string>();
  for (const reaccion of reacciones ?? []) {
    totalMeGustaPorId.set(reaccion.id_calificacion, (totalMeGustaPorId.get(reaccion.id_calificacion) ?? 0) + 1);
    if (usuarioId && reaccion.id_usuario === usuarioId) meGustaDelUsuario.add(reaccion.id_calificacion);
  }

  const reseñas: CalificacionCurso[] = reseñasBase.map((fila) => ({
    id: fila.id,
    autorId: fila.id_usuario,
    autorNombre: nombrePorAutorId.get(fila.id_usuario) ?? "Estudiante UVA",
    autorFotoUrl: fotoPorAutorId.get(fila.id_usuario) ?? null,
    puntuacion: fila.puntuacion,
    comentario: fila.comentario,
    tiempo: tiempoRelativo(fila.creado_en),
    totalMeGusta: totalMeGustaPorId.get(fila.id) ?? 0,
    meGusta: meGustaDelUsuario.has(fila.id),
  }));

  return {
    promedio: resumen?.promedio ?? null,
    total: resumen?.total ?? 0,
    reseñas,
    miCalificacion: (usuarioId && reseñas.find((reseña) => reseña.autorId === usuarioId)) || null,
  };
}
