import { createClient } from "@/lib/supabase/server";
import type { CategoriaChip } from "@/lib/categoria";

export type CursoConProgreso = {
  cursoId: string;
  cursoSlug: string;
  titulo: string;
  imagenPortada: string;
  /** Todas las categorías del curso — ver CategoriaChip en lib/categoria.ts. */
  categorias: CategoriaChip[];
  leccionesCompletadas: number;
  leccionesTotal: number;
  porcentaje: number;
  /** El curso tiene examen final publicado, así que terminar las clases no
   * basta para completarlo (docs/functional-spec.md Flujo 07 — Revf5). */
  examenRequerido: boolean;
  examenAprobado: boolean;
  /** Regla de "curso completo" completa, la misma que decide la emisión del
   * certificado: 100% de clases y, si el curso exige examen, aprobado.
   * Centralizada acá para que la tarjeta, el filtro y el badge no la
   * recombinen cada uno por su cuenta. */
  completado: boolean;
};

export type ProgresoData = {
  cursos: CursoConProgreso[];
};

/**
 * Revf3: el % de avance se calcula en Postgres (vista
 * `progreso_cursos_estudiante`, supabase/sql/033_vista_progreso_cursos.sql)
 * con un `count(...) filter (...)` agregado por curso — no trayendo cada
 * fila de `progreso` y sumando acá. La vista ya excluye lecciones sin video
 * listo y ya viene acotada por RLS a las filas del usuario de la sesión, así
 * que esta función no necesita filtrar por usuario sobre ella.
 */
export async function getProgresoData(): Promise<ProgresoData> {
  const supabase = await createClient();

  const { data: filas } = await supabase
    .from("progreso_cursos_estudiante")
    .select(
      "curso_id, curso_slug, titulo, imagen_portada, lecciones_completadas, lecciones_total, examen_requerido, examen_aprobado",
    )
    .order("ultima_actividad", { ascending: false });

  const cursoIds = (filas ?? []).map((fila) => fila.curso_id as string);

  // Consulta chica y acotada a los cursos ya tocados (no a todo el
  // catálogo): traer las categorías de cada uno es justo el tipo de
  // consulta liviana que la vista de arriba no necesita cubrir.
  const { data: categoriasPorCurso } = cursoIds.length
    ? await supabase.from("curso_categorias").select("id_curso, categoria:categorias(id, nombre)").in("id_curso", cursoIds)
    : { data: [] };

  // Todas las categorías del curso, no solo la primera — mismo criterio que
  // buscarCatalogo() (lib/categoria.ts, 059): `curso_categorias` es
  // muchos-a-muchos.
  const categoriasPorCursoMap = new Map<string, CategoriaChip[]>();
  for (const fila of categoriasPorCurso ?? []) {
    const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
    if (!categoria) continue;
    const lista = categoriasPorCursoMap.get(fila.id_curso as string) ?? [];
    lista.push({ id: categoria.id as string, nombre: categoria.nombre as string });
    categoriasPorCursoMap.set(fila.id_curso as string, lista);
  }

  const cursos: CursoConProgreso[] = (filas ?? []).map((fila) => {
    const total = fila.lecciones_total as number;
    const completadas = fila.lecciones_completadas as number;
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
    const examenRequerido = fila.examen_requerido === true;
    const examenAprobado = fila.examen_aprobado === true;

    return {
      cursoId: fila.curso_id as string,
      cursoSlug: fila.curso_slug as string,
      titulo: fila.titulo as string,
      imagenPortada: fila.imagen_portada as string,
      categorias: categoriasPorCursoMap.get(fila.curso_id as string) ?? [{ id: "general", nombre: "General" }],
      leccionesCompletadas: completadas,
      leccionesTotal: total,
      porcentaje,
      examenRequerido,
      examenAprobado,
      // Antes esto era `porcentaje === 100` en la UI. Con exámenes, un curso
      // al 100% de clases con el examen sin aprobar NO está completo: no tiene
      // certificado, así que tampoco puede decir "Completado".
      completado: porcentaje === 100 && (!examenRequerido || examenAprobado),
    };
  });

  return { cursos };
}
