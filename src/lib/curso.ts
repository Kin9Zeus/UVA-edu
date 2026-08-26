import { createClient } from "@/lib/supabase/server";

export type LeccionPublica = {
  id: string;
  titulo: string;
  orden: number;
  duracion: number | null;
  completado: boolean;
};

export type ModuloPublico = {
  id: string;
  titulo: string;
  orden: number;
  lecciones: LeccionPublica[];
};

export type CategoriaDelCurso = {
  id: string;
  slug: string;
  nombre: string;
};

export type CursoPublico = {
  id: string;
  titulo: string;
  descripcion: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  /** Todas las categorías del curso — `curso_categorias` es muchos-a-muchos. */
  categorias: CategoriaDelCurso[];
  instructorNombre: string;
  instructorEspecialidad: string | null;
  imagenPortada: string;
  fechaEdicion: string;
  modulos: ModuloPublico[];
  totalClases: number;
  totalRecursos: number;
  duracionTotalSegundos: number;
  tieneAcceso: boolean;
  /** true si hay al menos una clase con progreso guardado (completada o no). */
  progresoIniciado: boolean;
  /**
   * Primera clase del temario todavía sin completar, para "Seguir viendo".
   * `null` si no hay progreso o si ya se completaron todas las clases.
   */
  leccionContinuarId: string | null;
  leccionContinuarTitulo: string | null;
  /** Posición 1..N de `leccionContinuarId` dentro del curso completo. */
  leccionContinuarNumero: number | null;
};

export async function getCursoPublico(
  cursoId: string,
  usuarioId: string | null,
): Promise<CursoPublico | null> {
  const supabase = await createClient();

  // Sin `.eq("mostrado", true)` a propósito: la policy "cursos_select_publicos"
  // (030_acceso_curso_despublicado.sql) ya deja pasar un curso despublicado
  // si el usuario tiene cortesía, o membresía con progreso ya guardado en
  // él — filtrar acá por `mostrado` otra vez le negaría a esa gente el
  // curso que RLS sí les permite ver. Si el curso está oculto y este
  // usuario no califica para ninguna excepción, RLS ya no devuelve la fila
  // y `curso` sale null, igual que antes.
  const { data: curso } = await supabase
    .from("cursos")
    .select(
      "id, titulo, descripcion, nivel, imagen_portada, fecha_edicion:actualizado_en, mostrado, instructor:instructores(nombre, especialidad)",
    )
    .eq("id", cursoId)
    .single();

  if (!curso) return null;

  // Todas las categorías del curso, no solo la primera: `curso_categorias`
  // es muchos-a-muchos y el CMS ya permite asignar varias (mismo criterio
  // que getCatalogo() en lib/categoria.ts). Antes se cortaba con .limit(1) y
  // el detalle del curso solo mostraba una, aunque el admin le hubiera
  // asignado dos o tres.
  const { data: categoriasCurso } = await supabase
    .from("curso_categorias")
    .select("id_categoria, categoria:categorias(id, slug, nombre)")
    .eq("id_curso", cursoId);

  const categorias: CategoriaDelCurso[] = (categoriasCurso ?? [])
    .map((fila) => {
      const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
      return categoria ? { id: categoria.id, slug: categoria.slug, nombre: categoria.nombre } : null;
    })
    .filter((categoria): categoria is CategoriaDelCurso => categoria !== null);

  const { data: modulos } = await supabase
    .from("modulos")
    .select("id, titulo, orden, lecciones(id, titulo, orden, duracion)")
    .eq("id_curso", cursoId)
    .order("orden");

  const modulosBase = (modulos ?? []).map((modulo) => ({
    id: modulo.id,
    titulo: modulo.titulo,
    orden: modulo.orden,
    lecciones: (modulo.lecciones ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((leccion) => ({
        id: leccion.id,
        titulo: leccion.titulo,
        orden: leccion.orden,
        duracion: leccion.duracion,
      })),
  }));

  const leccionIds = modulosBase.flatMap((modulo) => modulo.lecciones.map((leccion) => leccion.id));
  const totalClases = leccionIds.length;
  const duracionTotalSegundos = modulosBase.reduce(
    (total, modulo) =>
      total + modulo.lecciones.reduce((sub, leccion) => sub + (leccion.duracion ?? 0), 0),
    0,
  );

  const { count: totalRecursos } =
    leccionIds.length > 0
      ? await supabase
          .from("recursos_descargables")
          .select("id", { count: "exact", head: true })
          .in("id_leccion", leccionIds)
      : { count: 0 };

  let tieneAcceso = false;
  if (usuarioId) {
    const { data: inscripcion } = await supabase
      .from("inscripciones")
      .select("id")
      .eq("id_usuario", usuarioId)
      .eq("id_curso", cursoId)
      .maybeSingle();

    if (inscripcion) {
      tieneAcceso = true;
    } else {
      const { data: suscripcion } = await supabase
        .from("suscripciones")
        .select("estado")
        .eq("id_usuario", usuarioId)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      tieneAcceso = suscripcion?.estado === "ACTIVA" || suscripcion?.estado === "PAST_DUE";
    }
  }

  // Progreso guardado en las clases del curso: qué está completada (para el
  // check ✓ del temario) y cuál es la primera sin completar (para "Seguir
  // viendo" — Revcurso). Se usa el orden del temario, no "la última clase
  // que se abrió": esa pudo haberse completado ya, y retomar ahí mandaría
  // de vuelta a una clase terminada en vez de a la siguiente pendiente.
  let progresoIniciado = false;
  const completadoIds = new Set<string>();
  if (usuarioId && tieneAcceso && leccionIds.length > 0) {
    const { data: progresoRows } = await supabase
      .from("progreso")
      .select("id_leccion, completado")
      .eq("id_usuario", usuarioId)
      .in("id_leccion", leccionIds);

    progresoIniciado = (progresoRows ?? []).length > 0;
    for (const fila of progresoRows ?? []) {
      if (fila.completado) completadoIds.add(fila.id_leccion as string);
    }
  }

  const modulosPublicos: ModuloPublico[] = modulosBase.map((modulo) => ({
    ...modulo,
    lecciones: modulo.lecciones.map((leccion) => ({
      ...leccion,
      completado: completadoIds.has(leccion.id),
    })),
  }));

  const leccionesPlanas = modulosPublicos.flatMap((modulo) => modulo.lecciones);
  const siguiente = progresoIniciado
    ? leccionesPlanas.find((leccion) => !leccion.completado)
    : undefined;
  const leccionContinuarId = siguiente?.id ?? null;
  const leccionContinuarTitulo = siguiente?.titulo ?? null;
  const leccionContinuarNumero = siguiente
    ? leccionesPlanas.findIndex((leccion) => leccion.id === siguiente.id) + 1
    : null;

  const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;

  return {
    id: curso.id,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    nivel: curso.nivel,
    categorias,
    instructorNombre: instructor?.nombre ?? "Sin instructor",
    instructorEspecialidad: instructor?.especialidad ?? null,
    imagenPortada: curso.imagen_portada,
    fechaEdicion: curso.fecha_edicion,
    modulos: modulosPublicos,
    totalClases,
    totalRecursos: totalRecursos ?? 0,
    duracionTotalSegundos,
    tieneAcceso,
    progresoIniciado,
    leccionContinuarId,
    leccionContinuarTitulo,
    leccionContinuarNumero,
  };
}
