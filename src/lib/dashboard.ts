import { createClient } from "@/lib/supabase/server";

export type ClaseEnProgreso = {
  leccionId: string;
  cursoId: string;
  cursoTitulo: string;
  imagenPortada: string;
  moduloTitulo: string;
  categoriaNombre: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  duracionTotalCursoSegundos: number;
  duracion: number | null;
  /** Clases completadas / total del curso. `progreso` es ese cociente en %. */
  clasesCompletadas: number;
  totalClases: number;
  progreso: number;
};

export type CategoriaConConteo = {
  id: string;
  slug: string;
  nombre: string;
  cursos: number;
};

/**
 * Datos reales para el Dashboard/Inicio del estudiante: cursos con progreso
 * sin terminar (para "Sigue aprendiendo") y categorías activas con su
 * conteo de cursos publicados (para "Explora por categoría").
 *
 * Revf3: qué cursos tocó el estudiante y cuántas lecciones LISTAS tiene
 * completadas de cada uno sale de la vista `progreso_cursos_estudiante`
 * (supabase/sql/033_vista_progreso_cursos.sql) — un `count(...) filter`
 * agregado en Postgres, no una fila por cada progreso histórico traída acá
 * para sumar en JS. Solo se hace una consulta por curso candidato (acotada,
 * nunca por "todo el progreso") para averiguar CUÁL lección exacta es la
 * siguiente a retomar, algo que un conteo agregado no puede responder.
 *
 * Sin parámetro de usuario: la vista es `security_invoker` y ya viene
 * acotada por RLS al usuario de la sesión (createClient() más abajo), igual
 * que si se consultara `progreso` directamente con ese mismo cliente.
 */
export async function getInicioData() {
  const supabase = await createClient();

  const { data: progresoCursos } = await supabase
    .from("progreso_cursos_estudiante")
    .select("curso_id, titulo, imagen_portada, nivel, lecciones_total, lecciones_completadas")
    .order("ultima_actividad", { ascending: false });

  // Ya en orden de última actividad (la vista ordena así) y ya sin los
  // cursos terminados o sin ninguna lección lista todavía: nada de esto
  // necesita traer progreso lección por lección.
  const candidatos = (progresoCursos ?? []).filter(
    (curso) => curso.lecciones_total > 0 && curso.lecciones_completadas < curso.lecciones_total,
  );

  const cursoIds = candidatos.map((curso) => curso.curso_id as string);
  const { data: categoriasPorCurso } = cursoIds.length
    ? await supabase.from("curso_categorias").select("id_curso, categoria:categorias(nombre)").in("id_curso", cursoIds)
    : { data: [] };

  const categoriaPorCurso = new Map<string, string>();
  for (const fila of categoriasPorCurso ?? []) {
    if (categoriaPorCurso.has(fila.id_curso as string)) continue;
    const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
    categoriaPorCurso.set(fila.id_curso as string, categoria?.nombre ?? "General");
  }

  const sigueAprendiendo: ClaseEnProgreso[] = [];

  for (const curso of candidatos) {
    if (sigueAprendiendo.length >= 4) break;

    // Temario ordenado (solo lecciones LISTAS, "borrador" no cuenta) con la
    // marca de completado propia embebida: RLS en `progreso` acota esa
    // relación a la fila del propio usuario, igual que si se consultara la
    // tabla por separado.
    const { data: moduloRows } = await supabase
      .from("modulos")
      .select("orden, titulo, lecciones(id, orden, duracion, estado_procesamiento, progreso(completado))")
      .eq("id_curso", curso.curso_id)
      .order("orden");

    const leccionesOrdenadas = (moduloRows ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .flatMap((modulo) =>
        (modulo.lecciones ?? [])
          .filter((leccion) => leccion.estado_procesamiento === "LISTO")
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((leccion) => ({
            id: leccion.id as string,
            duracion: leccion.duracion as number | null,
            completada: !!leccion.progreso?.[0]?.completado,
            moduloTitulo: modulo.titulo as string,
          })),
      );

    if (leccionesOrdenadas.length === 0) continue;

    // La clase a retomar es la primera del temario que no esté completada —
    // no necesariamente la última que se abrió (esa pudo haberse terminado).
    const siguiente = leccionesOrdenadas.find((leccion) => !leccion.completada);
    if (!siguiente) continue;

    const completadas = leccionesOrdenadas.filter((leccion) => leccion.completada).length;
    const duracionTotalCursoSegundos = leccionesOrdenadas.reduce(
      (total, leccion) => total + (leccion.duracion ?? 0),
      0,
    );

    sigueAprendiendo.push({
      leccionId: siguiente.id,
      cursoId: curso.curso_id as string,
      cursoTitulo: curso.titulo as string,
      imagenPortada: curso.imagen_portada as string,
      moduloTitulo: siguiente.moduloTitulo,
      categoriaNombre: categoriaPorCurso.get(curso.curso_id as string) ?? "General",
      nivel: curso.nivel as ClaseEnProgreso["nivel"],
      duracionTotalCursoSegundos,
      duracion: siguiente.duracion,
      clasesCompletadas: completadas,
      totalClases: leccionesOrdenadas.length,
      progreso: Math.round((completadas / leccionesOrdenadas.length) * 100),
    });
  }

  const { data: categoriasRows } = await supabase
    .from("categorias")
    .select("id, slug, nombre")
    .eq("activo", true);

  const { data: cursosRows } = await supabase
    .from("cursos")
    .select("curso_categorias(id_categoria)")
    .eq("mostrado", true);

  // Un curso con varias categorías suma en todas ellas: el conteo dice
  // "cuántos cursos ves si entras acá", y entrando a cualquiera de sus
  // categorías el curso aparece.
  const conteoPorCategoria = new Map<string, number>();
  for (const curso of cursosRows ?? []) {
    for (const { id_categoria: idCategoria } of curso.curso_categorias ?? []) {
      conteoPorCategoria.set(idCategoria, (conteoPorCategoria.get(idCategoria) ?? 0) + 1);
    }
  }

  // Se listan todas las categorías activas, tengan o no cursos publicados
  // todavía: es la vitrina del catálogo completo, no solo de lo que ya tiene
  // contenido.
  const categorias: CategoriaConConteo[] = (categoriasRows ?? []).map((categoria) => ({
    id: categoria.id as string,
    slug: categoria.slug as string,
    nombre: categoria.nombre as string,
    cursos: conteoPorCategoria.get(categoria.id) ?? 0,
  }));

  return { sigueAprendiendo, categorias };
}
