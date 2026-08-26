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
 */
export async function getInicioData(usuarioId: string) {
  const supabase = await createClient();

  // Toda fila de progreso del estudiante, completada o no. Antes esta
  // consulta filtraba `completado = false`, así que un curso donde ya
  // había terminado todas las clases que había abierto (pero le faltaban
  // otras por empezar) no dejaba ninguna fila "a medias" y desaparecía de
  // "Sigue aprendiendo" aunque el curso estuviera lejos de terminado.
  const { data: progresoRows } = await supabase
    .from("progreso")
    .select(
      "id_leccion, completado, actualizado_en, leccion:lecciones(id, orden, duracion, modulo:modulos(id, orden, titulo, curso:cursos(id, titulo, imagen_portada, nivel, mostrado, curso_categorias(categoria:categorias(nombre)))))",
    )
    .eq("id_usuario", usuarioId)
    .order("actualizado_en", { ascending: false });

  type FilaProgreso = {
    leccionId: string;
    completado: boolean;
    actualizadoEn: string;
    leccionOrden: number;
    duracion: number | null;
    moduloId: string;
    moduloOrden: number;
    moduloTitulo: string;
    cursoId: string;
    cursoTitulo: string;
    imagenPortada: string;
    nivel: ClaseEnProgreso["nivel"];
    categoriaNombre: string;
  };

  const filas = (progresoRows ?? [])
    .map((fila): FilaProgreso | null => {
      const leccion = Array.isArray(fila.leccion) ? fila.leccion[0] : fila.leccion;
      const modulo = leccion ? (Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo) : null;
      const curso = modulo ? (Array.isArray(modulo.curso) ? modulo.curso[0] : modulo.curso) : null;
      const categoria = curso?.curso_categorias?.[0]?.categoria
        ? Array.isArray(curso.curso_categorias[0].categoria)
          ? curso.curso_categorias[0].categoria[0]
          : curso.curso_categorias[0].categoria
        : null;

      // Antes se excluía todo curso con `mostrado = false`, pero eso
      // contradice la regla de acceso vigente (030_acceso_curso_despublicado.sql,
      // Revcurso): un estudiante con membresía que YA tenía progreso en un
      // curso que se despublica debe poder seguir viéndolo — no solo
      // conservar el progreso en la base, sino seguir apareciendo acá para
      // retomarlo. Como esta consulta usa el cliente de sesión (sujeto a
      // RLS), si `curso` viene no-nulo es porque RLS ya confirmó acceso
      // vigente (cortesía, o membresía con este mismo progreso); no hace
      // falta repetir la comprobación de `mostrado` acá.
      if (!leccion || !modulo || !curso) return null;

      return {
        leccionId: fila.id_leccion as string,
        completado: fila.completado as boolean,
        actualizadoEn: fila.actualizado_en as string,
        leccionOrden: leccion.orden as number,
        duracion: leccion.duracion,
        moduloId: modulo.id as string,
        moduloOrden: modulo.orden as number,
        moduloTitulo: modulo.titulo as string,
        cursoId: curso.id as string,
        cursoTitulo: curso.titulo as string,
        imagenPortada: curso.imagen_portada as string,
        nivel: curso.nivel as ClaseEnProgreso["nivel"],
        categoriaNombre: categoria?.nombre ?? "General",
      };
    })
    .filter((fila): fila is FilaProgreso => fila !== null);

  // Cursos tocados, en el orden en que se avanzó por última vez en cada uno
  // (filas ya vienen ordenadas por actualizado_en desc).
  const cursoIdsOrdenados = [...new Set(filas.map((fila) => fila.cursoId))];

  const cursoIds = cursoIdsOrdenados;
  const { data: cursosInfo } = cursoIds.length
    ? await supabase.from("cursos").select("id, modulos(id, orden, lecciones(id, orden, duracion))").in("id", cursoIds)
    : { data: [] };

  const sigueAprendiendo: ClaseEnProgreso[] = [];

  for (const cursoId of cursoIdsOrdenados) {
    const cursoInfo = (cursosInfo ?? []).find((curso) => curso.id === cursoId);
    if (!cursoInfo) continue;

    const leccionesOrdenadas = (cursoInfo.modulos ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .flatMap((modulo) =>
        (modulo.lecciones ?? [])
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((leccion) => ({ id: leccion.id as string, duracion: leccion.duracion as number | null })),
      );

    if (leccionesOrdenadas.length === 0) continue;

    const duracionTotalCursoSegundos = leccionesOrdenadas.reduce(
      (total, leccion) => total + (leccion.duracion ?? 0),
      0,
    );

    const filasDelCurso = filas.filter((fila) => fila.cursoId === cursoId);
    const completadasIds = new Set(filasDelCurso.filter((fila) => fila.completado).map((fila) => fila.leccionId));

    // Curso ya terminado: nada que "seguir viendo".
    if (completadasIds.size >= leccionesOrdenadas.length) continue;

    // La clase a retomar es la primera del temario que no esté completada —
    // no necesariamente la última que se abrió (esa pudo haberse terminado).
    const siguiente = leccionesOrdenadas.find((leccion) => !completadasIds.has(leccion.id));
    if (!siguiente) continue;

    const filaReferencia = filasDelCurso[0];
    const progresoCurso = Math.round((completadasIds.size / leccionesOrdenadas.length) * 100);

    sigueAprendiendo.push({
      leccionId: siguiente.id,
      cursoId,
      cursoTitulo: filaReferencia.cursoTitulo,
      imagenPortada: filaReferencia.imagenPortada,
      moduloTitulo: filaReferencia.moduloTitulo,
      categoriaNombre: filaReferencia.categoriaNombre,
      nivel: filaReferencia.nivel,
      duracionTotalCursoSegundos,
      duracion: siguiente.duracion,
      clasesCompletadas: completadasIds.size,
      totalClases: leccionesOrdenadas.length,
      progreso: progresoCurso,
    });

    if (sigueAprendiendo.length >= 4) break;
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
