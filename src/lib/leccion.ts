import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { obtenerAccesoAlCurso } from "@/lib/accesoCurso";
import { ANCHO_MINIATURA_TARJETA, ANCHO_MINIATURA_TEMARIO, getMiniaturaUrl } from "@/lib/mux/miniatura";
import { esUuid } from "@/lib/slug";
import { resolverContenidoLeccion, type DocumentoContenido } from "@/lib/editor/tipos";
import { getSituacionExamen } from "@/lib/examen";
import { porcentajeLecciones } from "@/lib/examenes/estadoPorCurso";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { logError } from "@/lib/log";

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
  /** Solo las clases con video listo cuentan para el avance: es la regla de
   * `progreso_cursos_estudiante` y de `private.lecciones_completas_curso`,
   * la que decide el certificado. Opcional por la vista previa de admin. */
  videoListo?: boolean;
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
  leccionId: string;
  leccionSlug: string;
  leccionTitulo: string;
  numero: number;
  /** Todas las clases del curso: numera "Clase 3 de 7". */
  totalClases: number;
  /** Las que cuentan para el avance (video listo). Puede ser menor que
   * `totalClases` si un video falló o sigue procesándose. */
  clasesConVideo: number;
  contenido: DocumentoContenido | null;
  duracion: number | null;
  /** Si el video ya terminó de procesarse en Mux; VideoPlayer pide su propio token firmado. */
  videoListo: boolean;
  /** Imagen del video de esta clase (Mux, firmada): póster y primer pintado. */
  posterUrl: string | null;
  recursos: RecursoLeccion[];
  lecciones: LeccionPlayerItem[];
  completadas: number;
  porcentaje: number;
  completada: boolean;
  anteriorId: string | null;
  anteriorSlug: string | null;
  siguienteId: string | null;
  siguienteSlug: string | null;
  /** true solo en la ÚLTIMA clase del curso (siguienteId = null) y solo si el
   * curso tiene examen final publicado — es lo que hace que "Siguiente clase"
   * se reemplace por "Hacer examen" en vez de simplemente desaparecer. No
   * distingue si el examen ya está aprobado/agotado: esos estados se resuelven
   * al entrar a /cursos/<slug>/examen, no acá — el botón solo decide adónde
   * apunta el CTA de cierre del curso. */
  examenDisponible: boolean;
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
 *
 * Envuelta en `cache()` de React al final del archivo: la página y su
 * `generateMetadata` la piden con los mismos argumentos, y sin esto el bloque
 * entero corría dos veces por petición.
 */
async function cargarLeccionPlayer(
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
  //
  // Un fallo de la base LANZA en todo lo que decide qué clase se muestra y
  // desde qué segundo (AUDIT-2026-09-22.md, seguimiento de P2-3): el curso, el
  // temario, el acceso (obtenerAccesoAlCurso) y el progreso. Antes cada fallo
  // salía como `null` —la página lo leía como "sin acceso" y devolvía al
  // estudiante a la ficha, o a un 404— o, en el progreso, como "sin avance":
  // el video arrancaba en 0 y el guardado periódico pisaba el segundo donde
  // el estudiante de verdad se había quedado. Lo accesorio (los recursos
  // descargables) se degrada y queda registrado: no vale tumbar la clase.
  //
  // `maybeSingle` y no `single`: con `single`, "no existe" también llega
  // como error (PGRST116) y lanzaría en vez de responder 404.
  //
  // Curso y temario en una sola consulta (embed de PostgREST, igual que
  // getCursoPublico): antes eran dos viajes en serie. El embed no trae
  // `contenido` ni `resumen` —el documento del editor de CADA clase— porque
  // solo hace falta el de la clase que se está viendo; ese se pide aparte,
  // abajo, junto con el resto de lecturas que ya no dependen unas de otras.
  const { data: curso, error: errorCurso } = await supabase
    .from("cursos")
    .select(
      `id, slug, titulo, mostrado,
      modulos(id, titulo, orden, lecciones(id, slug, titulo, orden, duracion, id_video_mux, estado_procesamiento))`,
    )
    .eq(esUuid(identificadorCurso) ? "id" : "slug", identificadorCurso)
    .maybeSingle();
  lanzarSiFalla(errorCurso, "getLeccionPlayer:cursos");

  if (!curso) return null;
  const cursoId = curso.id;

  // La lista lateral y el temario numeran las clases de corrido (1..N) a lo
  // largo de todo el curso, no por módulo: el encabezado dice "Clase 7 de 18".
  // El embed no garantiza el orden de las filas anidadas: se aplica acá.
  const plano = (curso.modulos ?? [])
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
  const esUltimaLeccion = indice === plano.length - 1;

  // Acceso, progreso, recursos, documento de la clase y examen no dependen
  // unos de otros —todos parten de ids que ya tenemos—, así que salen juntos
  // en vez de en serie. A cambio, a quien no tiene acceso se le hacen unas
  // lecturas de más antes de devolver `null`: es el caso raro (alguien con un
  // enlace guardado y la suscripción vencida), y RLS decide igual qué filas
  // vuelven.
  const [acceso, progreso, recursosRespuesta, contenidoRespuesta, situacionExamen] = await Promise.all([
    esIntroduccion ? Promise.resolve(null) : obtenerAccesoAlCurso(supabase, usuarioId, cursoId),
    usuarioId
      ? supabase
          .from("progreso")
          .select("id_leccion, completado, segundo_actual")
          .eq("id_usuario", usuarioId)
          .in(
            "id_leccion",
            plano.map((leccion) => leccion.id),
          )
      : Promise.resolve({ data: null, error: null }),
    // Sin url_archivo: es la ruta cruda del bucket privado, no una URL
    // usable, y no debe llegar al cliente. La descarga pasa por
    // obtenerUrlRecurso() (src/actions/cursos/recurso.ts), que la vuelve a
    // leer server-side justo antes de firmarla (P1-1, AUDIT-2026-08-26.md).
    supabase
      .from("recursos_descargables")
      .select("id, nombre, tipo_archivo, tamano_bytes")
      .eq("id_leccion", leccionId)
      .order("creado_en"),
    // Solo el documento de la clase que se ve (ver el comentario del embed).
    supabase.from("lecciones").select("contenido, resumen").eq("id", leccionId).maybeSingle(),
    // Solo se consulta en la última clase: es la única donde el botón de
    // cierre del reproductor puede necesitar cambiar de "Siguiente clase" a
    // "Hacer examen" — en cualquier otra, siguienteId ya no es null y el
    // botón sigue siendo el de siempre.
    esUltimaLeccion
      ? getSituacionExamen(curso.id, usuarioId)
      : Promise.resolve({ situacion: "SIN_EXAMEN" as const }),
  ]);

  // Antes que cualquier `lanzarSiFalla`: sin acceso se responde `null`, y un
  // fallo de lectura de las demás no debe convertir eso en un 500.
  if (acceso && !acceso.tieneAcceso) return null;

  lanzarSiFalla(progreso.error, "getLeccionPlayer:progreso");
  lanzarSiFalla(contenidoRespuesta.error, "getLeccionPlayer:contenido");

  const progresoPorLeccion = new Map<
    string,
    { id_leccion: string; completado: boolean; segundo_actual: number }
  >();
  for (const fila of progreso.data ?? []) {
    progresoPorLeccion.set(fila.id_leccion as string, fila);
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
      videoListo: leccion.videoListo,
      moduloId: leccion.moduloId,
      moduloTitulo: leccion.moduloTitulo,
      miniaturaUrl:
        leccion.videoListo && leccion.idVideoMux ? await getMiniaturaUrl(leccion.idVideoMux, ANCHO_MINIATURA_TEMARIO) : null,
    })),
  );

  // Un frame del video a ancho de tarjeta: es lo primero que se pinta en el
  // recuadro del reproductor (ver PosterDelVideo).
  const posterUrl =
    actual.videoListo && actual.idVideoMux ? await getMiniaturaUrl(actual.idVideoMux, ANCHO_MINIATURA_TARJETA) : null;

  const { data: recursos, error: errorRecursos } = recursosRespuesta;
  if (errorRecursos) {
    logError("leccion:recursos", "no se pudieron leer los recursos de la clase", errorRecursos, {
      area: "reproductor",
      leccionId,
    });
  }

  // Mismo denominador que la pantalla de Progreso y que el certificado: antes
  // el reproductor decía "0 de 7 clases" mientras Progreso decía "0/0" para
  // el mismo curso, porque aquí se contaban también las clases sin video.
  const completadas = lecciones.filter((leccion) => leccion.completado && leccion.videoListo).length;
  const totalClases = lecciones.length;
  const clasesConVideo = lecciones.filter((leccion) => leccion.videoListo).length;

  return {
    cursoId: curso.id,
    cursoSlug: curso.slug,
    cursoTitulo: curso.titulo,
    leccionId: actual.id,
    leccionSlug: actual.slug,
    leccionTitulo: actual.titulo,
    numero: indice + 1,
    totalClases,
    clasesConVideo,
    contenido: resolverContenidoLeccion(
      contenidoRespuesta.data?.contenido ?? null,
      (contenidoRespuesta.data?.resumen as string | null | undefined) ?? null,
    ),
    duracion: actual.duracion,
    videoListo: actual.videoListo,
    posterUrl,
    recursos: (recursos ?? []).map((recurso) => ({
      id: recurso.id,
      nombre: recurso.nombre,
      tipoArchivo: recurso.tipo_archivo,
      tamanoBytes: recurso.tamano_bytes,
    })),
    lecciones,
    completadas,
    porcentaje: porcentajeLecciones(completadas, clasesConVideo),
    completada: !!progresoPorLeccion.get(actual.id)?.completado,
    anteriorId: indice > 0 ? plano[indice - 1].id : null,
    anteriorSlug: indice > 0 ? plano[indice - 1].slug : null,
    siguienteId: indice < plano.length - 1 ? plano[indice + 1].id : null,
    siguienteSlug: indice < plano.length - 1 ? plano[indice + 1].slug : null,
    examenDisponible: situacionExamen.situacion !== "SIN_EXAMEN",
    segundoActual: progresoPorLeccion.get(actual.id)?.segundo_actual ?? 0,
    puedeComentar: !!usuarioId,
  };
}

export const getLeccionPlayer = cache(cargarLeccionPlayer);
