import { createClient } from "@/lib/supabase/server";
import { suscripcionDaAcceso } from "@/lib/estadoAcceso";

export type RecursoLeccion = {
  id: string;
  nombre: string;
  tipoArchivo: string;
  tamanoBytes: number | null;
};

/** Una clase dentro de la lista lateral "Clases y progreso" del reproductor. */
export type LeccionPlayerItem = {
  id: string;
  /** Posición 1..N dentro del curso completo, no dentro del módulo. */
  numero: number;
  titulo: string;
  duracion: number | null;
  completado: boolean;
  moduloId: string;
  moduloTitulo: string;
};

export type LeccionPlayer = {
  cursoId: string;
  cursoTitulo: string;
  categoriaSlug: string;
  leccionId: string;
  leccionTitulo: string;
  numero: number;
  totalClases: number;
  resumen: string | null;
  duracion: number | null;
  /** Si el video ya terminó de procesarse en Mux; VideoPlayer pide su propio token firmado. */
  videoListo: boolean;
  recursos: RecursoLeccion[];
  lecciones: LeccionPlayerItem[];
  completadas: number;
  porcentaje: number;
  completada: boolean;
  anteriorId: string | null;
  siguienteId: string | null;
  /** Segundo en el que quedó el estudiante (tabla progreso). */
  segundoActual: number;
};

/**
 * Verifica que el usuario pueda ver el contenido del curso: cortesía al
 * curso, o suscripción VIGENTE por estado y fecha (`suscripcionDaAcceso`).
 * Misma regla que `getCursoPublico` en lib/curso.ts y que el firmado del
 * token de Mux — el catálogo muestra el temario a cualquiera, con candado,
 * pero el reproductor exige acceso vigente.
 */
async function tieneAccesoAlCurso(cursoId: string, usuarioId: string) {
  const supabase = await createClient();

  // Solo CORTESIA: una MEMBRESIA no sobrevive a la suscripción que la
  // originó (ver src/lib/mux/acceso.ts).
  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id")
    .eq("id_usuario", usuarioId)
    .eq("id_curso", cursoId)
    .eq("tipo_acceso", "CORTESIA")
    .maybeSingle();

  if (inscripcion) return true;

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select("estado, fecha_renovacion")
    .eq("id_usuario", usuarioId)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  return suscripcionDaAcceso(
    suscripcion && { estado: suscripcion.estado, fechaRenovacion: suscripcion.fecha_renovacion },
  );
}

export async function getLeccionPlayer(
  cursoId: string,
  leccionId: string,
  usuarioId: string,
): Promise<LeccionPlayer | null> {
  const supabase = await createClient();

  // Sin `.eq("mostrado", true)` a propósito — mismo motivo que
  // getCursoPublico (lib/curso.ts): la policy "cursos_select_publicos"
  // (030_acceso_curso_despublicado.sql) ya deja ver un curso despublicado a
  // quien tiene cortesía, o membresía con progreso ya guardado. Filtrar acá
  // de nuevo por `mostrado` le cortaría el reproductor a esa misma gente
  // que RLS sí autoriza.
  const { data: curso } = await supabase
    .from("cursos")
    .select("id, titulo, mostrado")
    .eq("id", cursoId)
    .single();

  if (!curso) return null;
  if (!(await tieneAccesoAlCurso(cursoId, usuarioId))) return null;

  const { data: categoriaCurso } = await supabase
    .from("curso_categorias")
    .select("categoria:categorias(slug)")
    .eq("id_curso", cursoId)
    .limit(1)
    .maybeSingle();
  const categoriaEmbebida = categoriaCurso?.categoria;
  const categoria = Array.isArray(categoriaEmbebida) ? categoriaEmbebida[0] : categoriaEmbebida;

  const { data: modulos } = await supabase
    .from("modulos")
    .select(
      "id, titulo, orden, lecciones(id, titulo, orden, duracion, resumen, id_video_mux, estado_procesamiento)",
    )
    .eq("id_curso", cursoId)
    .order("orden");

  // La lista lateral y el temario numeran las clases de corrido (1..N) a lo
  // largo de todo el curso, no por módulo: el encabezado dice "Clase 7 de 18".
  const plano = (modulos ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .flatMap((modulo) =>
      (modulo.lecciones ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((leccion) => ({
          id: leccion.id as string,
          titulo: leccion.titulo as string,
          duracion: (leccion.duracion ?? null) as number | null,
          resumen: (leccion.resumen ?? null) as string | null,
          videoListo: !!leccion.id_video_mux && leccion.estado_procesamiento === "LISTO",
          moduloId: modulo.id as string,
          moduloTitulo: modulo.titulo as string,
        })),
    );

  const indice = plano.findIndex((leccion) => leccion.id === leccionId);
  if (indice === -1) return null;
  const actual = plano[indice];

  const { data: progresoRows } = await supabase
    .from("progreso")
    .select("id_leccion, completado, segundo_actual")
    .eq("id_usuario", usuarioId)
    .in(
      "id_leccion",
      plano.map((leccion) => leccion.id),
    );

  const progresoPorLeccion = new Map(
    (progresoRows ?? []).map((fila) => [fila.id_leccion as string, fila]),
  );

  const lecciones: LeccionPlayerItem[] = plano.map((leccion, i) => ({
    id: leccion.id,
    numero: i + 1,
    titulo: leccion.titulo,
    duracion: leccion.duracion,
    completado: !!progresoPorLeccion.get(leccion.id)?.completado,
    moduloId: leccion.moduloId,
    moduloTitulo: leccion.moduloTitulo,
  }));

  // Sin url_archivo: es la ruta cruda del bucket privado, no una URL
  // usable, y no debe llegar al cliente. La descarga pasa por
  // obtenerUrlRecurso() (src/actions/cursos/recurso.ts), que la vuelve a
  // leer server-side justo antes de firmarla (P1-1, AUDIT-2026-08-26.md).
  const { data: recursos } = await supabase
    .from("recursos_descargables")
    .select("id, nombre, tipo_archivo, tamano_bytes")
    .eq("id_leccion", leccionId)
    .order("creado_en");

  const completadas = lecciones.filter((leccion) => leccion.completado).length;
  const totalClases = lecciones.length;

  return {
    cursoId: curso.id,
    cursoTitulo: curso.titulo,
    categoriaSlug: categoria?.slug ?? "",
    leccionId: actual.id,
    leccionTitulo: actual.titulo,
    numero: indice + 1,
    totalClases,
    resumen: actual.resumen,
    duracion: actual.duracion,
    videoListo: actual.videoListo,
    recursos: (recursos ?? []).map((recurso) => ({
      id: recurso.id,
      nombre: recurso.nombre,
      tipoArchivo: recurso.tipo_archivo,
      tamanoBytes: recurso.tamano_bytes,
    })),
    lecciones,
    completadas,
    porcentaje: totalClases > 0 ? Math.round((completadas / totalClases) * 100) : 0,
    completada: !!progresoPorLeccion.get(actual.id)?.completado,
    anteriorId: indice > 0 ? plano[indice - 1].id : null,
    siguienteId: indice < plano.length - 1 ? plano[indice + 1].id : null,
    segundoActual: progresoPorLeccion.get(actual.id)?.segundo_actual ?? 0,
  };
}
