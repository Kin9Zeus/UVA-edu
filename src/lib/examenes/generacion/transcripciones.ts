import { createAdminClient } from "@/lib/supabase/admin";
import {
  CursoSinVideosError,
  TranscripcionesFaltantesError,
  type VideoConTranscripcion,
} from "./tipos";

/**
 * Lee de la BASE las transcripciones de todos los videos de un curso.
 *
 * Nunca pide nada a Mux. Esa es la decisión central de este módulo y la razón
 * por la que existe `transcripciones_video`: el webhook
 * `video.asset.track.ready` guarda el texto UNA vez, cuando llega, y la
 * generación del examen solo lee. Lo contrario —descargar los VTT de las 20
 * clases cada vez que un administrador pulsa "generar"— serían 20 peticiones
 * HTTP con sus 20 tokens firmados en el camino caliente de un clic, y un
 * examen que no se puede regenerar si Mux está caído o si el asset se borró.
 *
 * Service Role: `transcripciones_video` no tiene política de SELECT para
 * `authenticated` salvo administradores (supabase/sql/088), y esta función la
 * llama un Server Action que YA verificó el rol. Mismo patrón que el resto de
 * los Server Actions de administrador.
 *
 * @throws {CursoSinVideosError} el curso no tiene lecciones con video listo.
 * @throws {TranscripcionesFaltantesError} alguna de esas lecciones todavía no
 *   tiene transcripción.
 */
export async function obtenerVideosConTranscripcion(
  courseId: string,
): Promise<VideoConTranscripcion[]> {
  const revision = await revisarTranscripcionesCurso(courseId);

  if (revision.videos.length === 0 && revision.faltantes.length === 0) {
    throw new CursoSinVideosError(courseId);
  }

  // Todo o nada. Un examen al que le faltan las preguntas de tres clases
  // sigue calificando sobre 100% y le niega el certificado a alguien que sí
  // vio el curso entero — y nadie se entera, porque el examen "existe".
  if (revision.faltantes.length > 0) {
    throw new TranscripcionesFaltantesError(revision.faltantes);
  }

  return revision.videos;
}

/**
 * Lo mismo que `obtenerVideosConTranscripcion`, pero SIN lanzar: dice cuántos
 * videos tiene el curso y cuáles siguen sin transcripción.
 *
 * Existe separada porque el panel necesita decir «faltan 3 de 12» ANTES de que
 * nadie pulse el botón, y una excepción solo puede llevar la lista de los que
 * faltan — no el total. Reconstruir «12» desde `TranscripcionesFaltantesError`
 * es imposible, así que la consulta es la fuente y la excepción es una vista
 * sobre ella, no al revés.
 */
export async function revisarTranscripcionesCurso(courseId: string): Promise<{
  /** Videos con transcripción lista, en orden de temario. */
  videos: VideoConTranscripcion[];
  faltantes: { videoId: string; title: string }[];
  /** Con y sin transcripción: el denominador de «faltan 3 de 12». */
  totalVideos: number;
}> {
  const admin = createAdminClient();

  // Qué cuenta como "video del curso": una lección con el procesamiento en
  // LISTO. Se filtra por ahí y no por `id_mux_asset_id is not null` porque una
  // lección en PROCESANDO ya tiene asset id y todavía no tiene subtítulos —
  // aparecería como "falta la transcripción" cuando en realidad falta el
  // video. Una lección en ERROR tampoco es un video del curso: no se reproduce.
  //
  // `lecciones` no tiene `id_curso`; se llega por el módulo. El orden
  // (modulo.orden, leccion.orden) es el del temario, y es el que hereda el
  // examen al persistir.
  const { data: lecciones, error: errorLecciones } = await admin
    .from("lecciones")
    .select("id, titulo, orden, modulo:modulos!inner(orden, id_curso)")
    .eq("modulo.id_curso", courseId)
    .eq("estado_procesamiento", "LISTO")
    .order("orden", { ascending: true });

  if (errorLecciones) {
    throw new Error(`No se pudieron leer las lecciones del curso: ${errorLecciones.message}`);
  }

  if (!lecciones || lecciones.length === 0) {
    return { videos: [], faltantes: [], totalVideos: 0 };
  }

  // El `Array.isArray(...) ? [0] : ...` es la forma en que este proyecto
  // consume relaciones embebidas de PostgREST (ver usuarioDetalle.ts): sin los
  // tipos generados de Supabase, el cliente tipa todo embed como array aunque
  // un `!inner` a la tabla padre devuelva un objeto.
  const conModulo = lecciones.map((leccion) => {
    const modulo = Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo;
    return {
      id: leccion.id as string,
      titulo: leccion.titulo as string,
      orden: (leccion.orden as number) ?? 0,
      ordenModulo: (modulo?.orden as number | undefined) ?? 0,
    };
  });

  // PostgREST no sabe ordenar por una columna de la tabla embebida, así que el
  // orden del temario se termina de armar acá. Sin esto, el examen sale con
  // las preguntas del módulo 3 antes que las del 1 cuando dos lecciones
  // comparten `orden` dentro de sus módulos respectivos.
  const ordenadas = conModulo.sort(
    (a, b) => a.ordenModulo - b.ordenModulo || a.orden - b.orden,
  );

  const { data: transcripciones, error: errorTranscripciones } = await admin
    .from("transcripciones_video")
    .select("id_leccion, transcripcion")
    .eq("id_curso", courseId);

  if (errorTranscripciones) {
    throw new Error(
      `No se pudieron leer las transcripciones del curso: ${errorTranscripciones.message}`,
    );
  }

  // Una fila con `transcripcion` vacía cuenta como ausente: existe porque el
  // webhook llegó, pero no hay texto del que sacar preguntas. Tratarla como
  // presente produciría un video con cero preguntas y ningún aviso de por qué.
  const porLeccion = new Map(
    (transcripciones ?? [])
      .filter((fila) => fila.transcripcion.trim() !== "")
      .map((fila) => [fila.id_leccion, fila.transcripcion]),
  );

  const faltantes = ordenadas
    .filter((leccion) => !porLeccion.has(leccion.id))
    .map((leccion) => ({ videoId: leccion.id, title: leccion.titulo }));

  const videos = ordenadas
    .filter((leccion) => porLeccion.has(leccion.id))
    .map((leccion) => ({
      videoId: leccion.id,
      title: leccion.titulo,
      transcript: porLeccion.get(leccion.id)!,
    }));

  return { videos, faltantes, totalVideos: ordenadas.length };
}

/** Transcripción de UN video, para validar el fragmento de una pregunta
 * concreta. Devuelve `null` si no hay. */
export async function obtenerTranscripcionDeVideo(videoId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("transcripciones_video")
    .select("transcripcion")
    .eq("id_leccion", videoId)
    .maybeSingle();

  if (error || !data) return null;
  return data.transcripcion;
}
