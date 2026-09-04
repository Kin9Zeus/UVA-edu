import { createClient } from "@/lib/supabase/server";
import { obtenerAccesoAlCurso } from "@/lib/accesoCurso";
import { getMiniaturaUrl } from "@/lib/mux/miniatura";
import { esUuid } from "@/lib/slug";
import { resolverContenidoLeccion, type DocumentoContenido } from "@/lib/editor/tipos";

export type RecursoLeccion = {
  id: string;
  nombre: string;
  tipoArchivo: string;
  tamanoBytes: number | null;
};

/** Una clase dentro de la lista lateral "Clases y progreso" del reproductor. */
export type LeccionPlayerItem = {
  id: string;
  /** Ausente en LeccionEnListaVistaPrevia (lib/admin/resolverVistaPrevia.ts),
   * que reusa este mismo tipo para TemarioDrawer sin tener slug — esa vista
   * previa por token sigue navegando por id, no por slug. */
  slug?: string;
  /** Posición 1..N dentro del curso completo, no dentro del módulo. */
  numero: number;
  titulo: string;
  duracion: number | null;
  completado: boolean;
  moduloId: string;
  moduloTitulo: string;
  /** Frame real del video ya procesado, para el cuadro del Temario
   * (Revcurso). `null`/ausente sin video listo, o si Mux no pudo firmar el
   * token — TemarioDrawer cae de vuelta al cuadro oscuro de siempre.
   * Opcional: la vista previa de admin (LeccionVistaPreviaContent) reusa
   * el mismo Temario sin pedirle miniaturas todavía. */
  miniaturaUrl?: string | null;
};

export type LeccionPlayer = {
  cursoId: string;
  cursoSlug: string;
  cursoTitulo: string;
  categoriaSlug: string;
  leccionId: string;
  leccionSlug: string;
  leccionTitulo: string;
  numero: number;
  totalClases: number;
  contenido: DocumentoContenido | null;
  duracion: number | null;
  /** Si el video ya terminó de procesarse en Mux; VideoPlayer pide su propio token firmado. */
  videoListo: boolean;
  recursos: RecursoLeccion[];
  lecciones: LeccionPlayerItem[];
  completadas: number;
  porcentaje: number;
  completada: boolean;
  anteriorId: string | null;
  anteriorSlug: string | null;
  siguienteId: string | null;
  siguienteSlug: string | null;
  /** Segundo en el que quedó el estudiante (tabla progreso). */
  segundoActual: number;
  /** Con sesión iniciada: puede comentar (RLS exige `auth.uid()`, un
   * visitante anónimo en la vista previa nunca puede, aunque sí lea). */
  puedeComentar: boolean;
};

/**
 * Resuelve curso y lección por slug o UUID (enlaces anteriores al cambio de
 * rutas siguen resolviendo por UUID) — mismo patrón que `resolverCategoria`
 * (lib/categoria.ts) y `getCursoPublico` (lib/curso.ts).
 */
export async function getLeccionPlayer(
  identificadorCurso: string,
  identificadorLeccion: string,
  usuarioId: string | null,
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
    .select("id, slug, titulo, mostrado")
    .eq(esUuid(identificadorCurso) ? "id" : "slug", identificadorCurso)
    .single();

  if (!curso) return null;
  const cursoId = curso.id;

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
      "id, titulo, orden, lecciones(id, slug, titulo, orden, duracion, resumen, contenido, id_video_mux, estado_procesamiento)",
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
        .map((leccion) => {
          const videoListo = !!leccion.id_video_mux && leccion.estado_procesamiento === "LISTO";
          return {
            id: leccion.id as string,
            slug: leccion.slug as string,
            titulo: leccion.titulo as string,
            // Sin video LISTO, `duracion` no corresponde a ningún video real
            // (ver la misma regla en lib/curso.ts) — se oculta para no
            // mostrar minutos que no salen de ningún video.
            duracion: (videoListo ? (leccion.duracion ?? null) : null) as number | null,
            resumen: (leccion.resumen ?? null) as string | null,
            contenido: leccion.contenido as unknown | null,
            videoListo,
            idVideoMux: leccion.id_video_mux as string | null,
            moduloId: modulo.id as string,
            moduloTitulo: modulo.titulo as string,
          };
        }),
    );

  const indice = plano.findIndex((leccion) =>
    esUuid(identificadorLeccion)
      ? leccion.id === identificadorLeccion
      : leccion.slug === identificadorLeccion,
  );
  if (indice === -1) return null;
  const actual = plano[indice];
  const leccionId = actual.id;

  // La primera lección del curso es vista previa pública (Revcurso: "que la
  // primera lección sea visible", ver lib/video/reproduccion.ts para la
  // misma regla aplicada al token de Mux). Cualquier otra exige cortesía o
  // suscripción vigente — misma regla que `getCursoPublico` (lib/curso.ts).
  // `plano.length > 1`: un curso de una sola lección no tiene introducción
  // separada del contenido pagado — esa única lección ES el curso completo.
  const esIntroduccion = indice === 0 && plano.length > 1;
  if (!esIntroduccion) {
    if (!(await obtenerAccesoAlCurso(supabase, usuarioId, cursoId)).tieneAcceso) return null;
  }

  const progresoPorLeccion = new Map<
    string,
    { id_leccion: string; completado: boolean; segundo_actual: number }
  >();
  if (usuarioId) {
    const { data: progresoRows } = await supabase
      .from("progreso")
      .select("id_leccion, completado, segundo_actual")
      .eq("id_usuario", usuarioId)
      .in(
        "id_leccion",
        plano.map((leccion) => leccion.id),
      );
    for (const fila of progresoRows ?? []) {
      progresoPorLeccion.set(fila.id_leccion as string, fila);
    }
  }

  // Un signPlaybackId() por lección, en paralelo: es una firma JWT local
  // (HMAC/RSA), no una llamada de red a Mux, así que no importa que un
  // curso tenga muchas clases — nunca golpea un rate limit externo.
  const lecciones: LeccionPlayerItem[] = await Promise.all(
    plano.map(async (leccion, i) => ({
      id: leccion.id,
      slug: leccion.slug,
      numero: i + 1,
      titulo: leccion.titulo,
      duracion: leccion.duracion,
      completado: !!progresoPorLeccion.get(leccion.id)?.completado,
      moduloId: leccion.moduloId,
      moduloTitulo: leccion.moduloTitulo,
      miniaturaUrl:
        leccion.videoListo && leccion.idVideoMux ? await getMiniaturaUrl(leccion.idVideoMux) : null,
    })),
  );

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
    cursoSlug: curso.slug,
    cursoTitulo: curso.titulo,
    categoriaSlug: categoria?.slug ?? "",
    leccionId: actual.id,
    leccionSlug: actual.slug,
    leccionTitulo: actual.titulo,
    numero: indice + 1,
    totalClases,
    contenido: resolverContenidoLeccion(actual.contenido, actual.resumen),
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
    anteriorSlug: indice > 0 ? plano[indice - 1].slug : null,
    siguienteId: indice < plano.length - 1 ? plano[indice + 1].id : null,
    siguienteSlug: indice < plano.length - 1 ? plano[indice + 1].slug : null,
    segundoActual: progresoPorLeccion.get(actual.id)?.segundo_actual ?? 0,
    puedeComentar: !!usuarioId,
  };
}
