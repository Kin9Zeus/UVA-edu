import { createClient } from "@/lib/supabase/server";

export type CursoConProgreso = {
  cursoId: string;
  titulo: string;
  categoriaNombre: string;
  leccionesCompletadas: number;
  leccionesTotal: number;
  porcentaje: number;
};

export type ProgresoData = {
  clasesCompletadas: number;
  clasesTotal: number;
  certificados: number;
  cursos: CursoConProgreso[];
};

/**
 * Revf3: el % de avance se calcula en Postgres (vista
 * `progreso_cursos_estudiante`, supabase/sql/033_vista_progreso_cursos.sql)
 * con un `count(...) filter (...)` agregado por curso — no trayendo cada
 * fila de `progreso` y sumando acá. La vista ya excluye lecciones sin video
 * listo y ya viene acotada por RLS a las filas del usuario de la sesión, así
 * que esta función no vuelve a filtrar por `usuarioId` sobre ella.
 */
export async function getProgresoData(usuarioId: string): Promise<ProgresoData> {
  const supabase = await createClient();

  const [{ data: filas }, { count: certificadosCount }] = await Promise.all([
    supabase
      .from("progreso_cursos_estudiante")
      .select("curso_id, titulo, lecciones_completadas, lecciones_total")
      .order("ultima_actividad", { ascending: false }),
    supabase.from("certificados").select("id", { count: "exact", head: true }).eq("id_usuario", usuarioId),
  ]);

  const cursoIds = (filas ?? []).map((fila) => fila.curso_id as string);

  // Consulta chica y acotada a los cursos ya tocados (no a todo el
  // catálogo): traer la categoría de cada uno es justo el tipo de consulta
  // liviana que la vista de arriba no necesita cubrir.
  const { data: categoriasPorCurso } = cursoIds.length
    ? await supabase.from("curso_categorias").select("id_curso, categoria:categorias(nombre)").in("id_curso", cursoIds)
    : { data: [] };

  const categoriaPorCurso = new Map<string, string>();
  for (const fila of categoriasPorCurso ?? []) {
    if (categoriaPorCurso.has(fila.id_curso as string)) continue;
    const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
    categoriaPorCurso.set(fila.id_curso as string, categoria?.nombre ?? "General");
  }

  const cursos: CursoConProgreso[] = (filas ?? []).map((fila) => {
    const total = fila.lecciones_total as number;
    const completadas = fila.lecciones_completadas as number;
    return {
      cursoId: fila.curso_id as string,
      titulo: fila.titulo as string,
      categoriaNombre: categoriaPorCurso.get(fila.curso_id as string) ?? "General",
      leccionesCompletadas: completadas,
      leccionesTotal: total,
      porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0,
    };
  });

  const clasesCompletadas = cursos.reduce((total, curso) => total + curso.leccionesCompletadas, 0);
  const clasesTotal = cursos.reduce((total, curso) => total + curso.leccionesTotal, 0);

  return {
    clasesCompletadas,
    clasesTotal,
    certificados: certificadosCount ?? 0,
    cursos,
  };
}
