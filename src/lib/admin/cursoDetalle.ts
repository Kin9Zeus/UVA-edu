import { createClient } from "@/lib/supabase/server";

export type RecursoDetalle = {
  id: string;
  nombre: string;
  tipoArchivo: string;
  tamanoBytes: number | null;
};

export type LeccionDetalle = {
  id: string;
  titulo: string;
  orden: number;
  duracion: number | null;
  resumen: string | null;
  estadoProcesamiento: "SUBIENDO" | "PROCESANDO" | "LISTO" | "ERROR";
  errorProcesamiento: string | null;
  idMuxUploadId: string | null;
  idVideoMux: string | null;
  recursos: RecursoDetalle[];
};

export type ModuloDetalle = {
  id: string;
  titulo: string;
  orden: number;
  lecciones: LeccionDetalle[];
};

export type EstudianteDeCurso = {
  inscripcionId: string;
  usuarioId: string;
  nombre: string;
  progreso: number;
  estado: "EN_PROGRESO" | "COMPLETADO";
  tipoAcceso: "MEMBRESIA" | "CORTESIA";
};

export type CursoDetalle = {
  id: string;
  titulo: string;
  descripcion: string;
  imagenPortada: string;
  categoriaId: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  instructorId: string;
  instructor: string;
  mostrado: boolean;
  destacado: boolean;
  ordenVisualizacion: number;
  modulos: ModuloDetalle[];
  estudiantes: EstudianteDeCurso[];
};

export async function getCursoDetalle(cursoId: string): Promise<CursoDetalle | null> {
  const supabase = await createClient();

  const { data: curso } = await supabase
    .from("cursos")
    .select(
      "id, titulo, descripcion, imagen_portada, nivel, id_instructor, mostrado, destacado, orden_visualizacion, instructor:instructores(nombre)",
    )
    .eq("id", cursoId)
    .single();

  if (!curso) return null;

  // El CMS solo maneja una categoría por curso hoy; se toma la primera fila
  // de la puente (ver curso_categorias, auditoría de esquema Bloque 3).
  const { data: categoriaCurso } = await supabase
    .from("curso_categorias")
    .select("id_categoria")
    .eq("id_curso", cursoId)
    .limit(1)
    .maybeSingle();

  const { data: modulos } = await supabase
    .from("modulos")
    .select(
      "id, titulo, orden, lecciones(id, titulo, orden, duracion, resumen, estado_procesamiento, error_procesamiento, id_mux_upload_id, id_video_mux, recursos_descargables(id, nombre, tipo_archivo, tamano_bytes))",
    )
    .eq("id_curso", cursoId)
    .order("orden");

  const modulosDetalle: ModuloDetalle[] = (modulos ?? []).map((modulo) => ({
    id: modulo.id,
    titulo: modulo.titulo,
    orden: modulo.orden,
    lecciones: (modulo.lecciones ?? [])
      .sort((a, b) => a.orden - b.orden)
      .map((leccion) => ({
        id: leccion.id,
        titulo: leccion.titulo,
        orden: leccion.orden,
        duracion: leccion.duracion,
        resumen: leccion.resumen,
        estadoProcesamiento: leccion.estado_procesamiento,
        errorProcesamiento: leccion.error_procesamiento,
        idMuxUploadId: leccion.id_mux_upload_id,
        idVideoMux: leccion.id_video_mux,
        recursos: (leccion.recursos_descargables ?? []).map((recurso) => ({
          id: recurso.id,
          nombre: recurso.nombre,
          tipoArchivo: recurso.tipo_archivo,
          tamanoBytes: recurso.tamano_bytes,
        })),
      })),
  }));

  const leccionIds = modulosDetalle.flatMap((modulo) => modulo.lecciones.map((leccion) => leccion.id));

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    // Hint de FK explícito: inscripciones tiene dos relaciones hacia perfiles
    // (id_usuario y otorgado_por), así que `perfiles(nombre)` sin desambiguar
    // es un embed ambiguo para PostgREST y la query falla en silencio.
    .select("id, id_usuario, tipo_acceso, usuario:perfiles!inscripciones_id_usuario_fkey(nombre)")
    .eq("id_curso", cursoId);

  const { data: progreso } =
    leccionIds.length > 0
      ? await supabase.from("progreso").select("id_usuario, completado").in("id_leccion", leccionIds)
      : { data: [] };

  const progresoPorUsuario = new Map<string, { total: number; completados: number }>();
  for (const registro of progreso ?? []) {
    const actual = progresoPorUsuario.get(registro.id_usuario) ?? { total: 0, completados: 0 };
    actual.total += 1;
    if (registro.completado) actual.completados += 1;
    progresoPorUsuario.set(registro.id_usuario, actual);
  }

  const estudiantes: EstudianteDeCurso[] = (inscripciones ?? []).map((inscripcion) => {
    const usuario = Array.isArray(inscripcion.usuario) ? inscripcion.usuario[0] : inscripcion.usuario;
    const agregados = progresoPorUsuario.get(inscripcion.id_usuario);
    const porcentaje =
      agregados && agregados.total > 0 ? Math.round((agregados.completados / agregados.total) * 100) : 0;

    return {
      inscripcionId: inscripcion.id,
      usuarioId: inscripcion.id_usuario,
      nombre: usuario?.nombre ?? "Usuario eliminado",
      progreso: porcentaje,
      estado: porcentaje >= 100 && leccionIds.length > 0 ? "COMPLETADO" : "EN_PROGRESO",
      tipoAcceso: inscripcion.tipo_acceso,
    };
  });

  const instructor = Array.isArray(curso.instructor) ? curso.instructor[0] : curso.instructor;

  return {
    id: curso.id,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    imagenPortada: curso.imagen_portada,
    categoriaId: categoriaCurso?.id_categoria ?? "",
    nivel: curso.nivel,
    instructorId: curso.id_instructor,
    instructor: instructor?.nombre ?? "Sin instructor",
    mostrado: curso.mostrado,
    destacado: curso.destacado,
    ordenVisualizacion: curso.orden_visualizacion,
    modulos: modulosDetalle,
    estudiantes,
  };
}
