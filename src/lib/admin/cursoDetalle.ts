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
  /** Estudiantes distintos con una fila en `progreso` para esta lección (la
   * vieron o la completaron). Se usa para advertir antes de borrar — el
   * cascade de la base (progreso.id_leccion → ON DELETE CASCADE) la borra
   * en silencio si no se avisa antes. */
  estudiantesConProgreso: number;
};

export type ModuloDetalle = {
  id: string;
  titulo: string;
  orden: number;
  lecciones: LeccionDetalle[];
  /** Unión de estudiantesConProgreso de todas sus lecciones (sin duplicar
   * quien tiene progreso en más de una). */
  estudiantesConProgreso: number;
};

export type EstudianteDeCurso = {
  inscripcionId: string;
  usuarioId: string;
  nombre: string;
  progreso: number;
  estado: "EN_PROGRESO" | "COMPLETADO";
  tipoAcceso: "MEMBRESIA" | "CORTESIA";
};

/**
 * Enlace de vista previa tal como lo ve el panel. Nunca incluye el token:
 * la base solo guarda su hash, así que un enlace ya generado no se puede
 * volver a mostrar — solo revocar y generar otro.
 */
export type EnlaceVistaPrevia = {
  id: string;
  expiraEn: string;
  vecesUsado: number;
  creadoEn: string;
};

export type CursoDetalle = {
  id: string;
  titulo: string;
  descripcion: string;
  imagenPortada: string;
  /** Todas las categorías del curso (curso_categorias es muchos-a-muchos). */
  categoriaIds: string[];
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  instructorId: string;
  instructor: string;
  mostrado: boolean;
  destacado: boolean;
  ordenVisualizacion: number;
  modulos: ModuloDetalle[];
  estudiantes: EstudianteDeCurso[];
  /** Solo los que siguen vigentes (ni revocados ni caducados). */
  enlacesVistaPrevia: EnlaceVistaPrevia[];
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

  const { data: categoriasCurso } = await supabase
    .from("curso_categorias")
    .select("id_categoria")
    .eq("id_curso", cursoId);

  // Solo los vigentes: los revocados y los caducados se filtran en la
  // consulta para que el panel no liste enlaces que ya no abren nada. Las
  // filas siguen en la base como rastro (ver 025_rls_tokens_vista_previa).
  const { data: enlaces } = await supabase
    .from("tokens_vista_previa")
    .select("id, expira_en, veces_usado, creado_en")
    .eq("id_curso", cursoId)
    .is("revocado_en", null)
    .gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false });

  const { data: modulos } = await supabase
    .from("modulos")
    .select(
      "id, titulo, orden, lecciones(id, titulo, orden, duracion, resumen, estado_procesamiento, error_procesamiento, id_mux_upload_id, id_video_mux, recursos_descargables(id, nombre, tipo_archivo, tamano_bytes))",
    )
    .eq("id_curso", cursoId)
    .order("orden");

  const modulosSinProgreso = (modulos ?? []).map((modulo) => ({
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

  const leccionIds = modulosSinProgreso.flatMap((modulo) => modulo.lecciones.map((leccion) => leccion.id));

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    // Hint de FK explícito: inscripciones tiene dos relaciones hacia perfiles
    // (id_usuario y otorgado_por), así que `perfiles(nombre)` sin desambiguar
    // es un embed ambiguo para PostgREST y la query falla en silencio.
    .select("id, id_usuario, tipo_acceso, usuario:perfiles!inscripciones_id_usuario_fkey(nombre)")
    .eq("id_curso", cursoId);

  const { data: progreso } =
    leccionIds.length > 0
      ? await supabase.from("progreso").select("id_usuario, id_leccion, completado").in("id_leccion", leccionIds)
      : { data: [] };

  const progresoPorUsuario = new Map<string, { total: number; completados: number }>();
  const usuariosPorLeccion = new Map<string, Set<string>>();
  for (const registro of progreso ?? []) {
    const actual = progresoPorUsuario.get(registro.id_usuario) ?? { total: 0, completados: 0 };
    actual.total += 1;
    if (registro.completado) actual.completados += 1;
    progresoPorUsuario.set(registro.id_usuario, actual);

    const usuarios = usuariosPorLeccion.get(registro.id_leccion) ?? new Set<string>();
    usuarios.add(registro.id_usuario);
    usuariosPorLeccion.set(registro.id_leccion, usuarios);
  }

  const modulosDetalle: ModuloDetalle[] = modulosSinProgreso.map((modulo) => {
    const lecciones = modulo.lecciones.map((leccion) => ({
      ...leccion,
      estudiantesConProgreso: usuariosPorLeccion.get(leccion.id)?.size ?? 0,
    }));
    const usuariosModulo = new Set<string>();
    for (const leccion of lecciones) {
      for (const usuarioId of usuariosPorLeccion.get(leccion.id) ?? []) usuariosModulo.add(usuarioId);
    }
    return { ...modulo, lecciones, estudiantesConProgreso: usuariosModulo.size };
  });

  const estudiantes: EstudianteDeCurso[] = (inscripciones ?? []).map((inscripcion) => {
    const usuario = Array.isArray(inscripcion.usuario) ? inscripcion.usuario[0] : inscripcion.usuario;
    const agregados = progresoPorUsuario.get(inscripcion.id_usuario);
    // El denominador es el total de lecciones DEL CURSO, no cuántas de ellas
    // tienen fila en `progreso`. Antes se dividía por `agregados.total` (las
    // clases que el estudiante había abierto), así que a alguien que
    // terminó 5 de 10 clases y nunca tocó las otras 5 le salía 100%
    // ("Completado") en vez de 50%.
    const porcentaje =
      leccionIds.length > 0 && agregados
        ? Math.round((agregados.completados / leccionIds.length) * 100)
        : 0;

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
    categoriaIds: (categoriasCurso ?? []).map((fila) => fila.id_categoria as string),
    nivel: curso.nivel,
    instructorId: curso.id_instructor,
    instructor: instructor?.nombre ?? "Sin instructor",
    mostrado: curso.mostrado,
    destacado: curso.destacado,
    ordenVisualizacion: curso.orden_visualizacion,
    modulos: modulosDetalle,
    estudiantes,
    enlacesVistaPrevia: (enlaces ?? []).map((enlace) => ({
      id: enlace.id as string,
      expiraEn: enlace.expira_en as string,
      vecesUsado: enlace.veces_usado as number,
      creadoEn: enlace.creado_en as string,
    })),
  };
}
