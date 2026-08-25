import { createClient } from "@/lib/supabase/server";

export type LeccionPublica = {
  id: string;
  titulo: string;
  orden: number;
  duracion: number | null;
};

export type ModuloPublico = {
  id: string;
  titulo: string;
  orden: number;
  lecciones: LeccionPublica[];
};

export type CursoPublico = {
  id: string;
  titulo: string;
  descripcion: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  categoriaId: string;
  categoriaSlug: string;
  categoriaNombre: string;
  instructorNombre: string;
  instructorEspecialidad: string | null;
  imagenPortada: string;
  fechaEdicion: string;
  modulos: ModuloPublico[];
  totalClases: number;
  totalRecursos: number;
  duracionTotalSegundos: number;
  tieneAcceso: boolean;
};

export async function getCursoPublico(
  cursoId: string,
  usuarioId: string | null,
): Promise<CursoPublico | null> {
  const supabase = await createClient();

  const { data: curso } = await supabase
    .from("cursos")
    .select(
      "id, titulo, descripcion, nivel, imagen_portada, fecha_edicion:actualizado_en, mostrado, instructor:instructores(nombre, especialidad)",
    )
    .eq("id", cursoId)
    .eq("mostrado", true)
    .single();

  if (!curso) return null;

  // El catálogo solo maneja una categoría por curso hoy; se toma la primera
  // fila de la puente (ver curso_categorias, auditoría de esquema Bloque 3).
  const { data: categoriaCurso } = await supabase
    .from("curso_categorias")
    .select("id_categoria, categoria:categorias(slug, nombre)")
    .eq("id_curso", cursoId)
    .limit(1)
    .maybeSingle();
  const categoriaEmbebida = categoriaCurso?.categoria;
  const categoria = Array.isArray(categoriaEmbebida) ? categoriaEmbebida[0] : categoriaEmbebida;

  const { data: modulos } = await supabase
    .from("modulos")
    .select("id, titulo, orden, lecciones(id, titulo, orden, duracion)")
    .eq("id_curso", cursoId)
    .order("orden");

  const modulosPublicos: ModuloPublico[] = (modulos ?? []).map((modulo) => ({
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

  const leccionIds = modulosPublicos.flatMap((modulo) => modulo.lecciones.map((leccion) => leccion.id));
  const totalClases = leccionIds.length;
  const duracionTotalSegundos = modulosPublicos.reduce(
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

  const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;

  return {
    id: curso.id,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    nivel: curso.nivel,
    categoriaId: categoriaCurso?.id_categoria ?? "",
    categoriaSlug: categoria?.slug ?? "",
    categoriaNombre: categoria?.nombre ?? "General",
    instructorNombre: instructor?.nombre ?? "Sin instructor",
    instructorEspecialidad: instructor?.especialidad ?? null,
    imagenPortada: curso.imagen_portada,
    fechaEdicion: curso.fecha_edicion,
    modulos: modulosPublicos,
    totalClases,
    totalRecursos: totalRecursos ?? 0,
    duracionTotalSegundos,
    tieneAcceso,
  };
}
