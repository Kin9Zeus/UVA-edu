import { createClient } from "@/lib/supabase/server";

export type LeccionDetalle = {
  id: string;
  titulo: string;
  orden: number;
  duracion: number | null;
  resumen: string | null;
  estadoProcesamiento: "SUBIENDO" | "PROCESANDO" | "LISTO";
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
  categoriaId: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
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
      "id, titulo, descripcion, id_categoria, nivel, instructor, mostrado, destacado, orden_visualizacion",
    )
    .eq("id", cursoId)
    .single();

  if (!curso) return null;

  const { data: modulos } = await supabase
    .from("modulos")
    .select("id, titulo, orden, lecciones(id, titulo, orden, duracion, resumen, estado_procesamiento)")
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

  return {
    id: curso.id,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    categoriaId: curso.id_categoria,
    nivel: curso.nivel,
    instructor: curso.instructor,
    mostrado: curso.mostrado,
    destacado: curso.destacado,
    ordenVisualizacion: curso.orden_visualizacion,
    modulos: modulosDetalle,
    estudiantes,
  };
}
