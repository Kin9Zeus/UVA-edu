import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { registrarSiFalla } from "@/lib/supabase/registrar";
import { diaEnColombia } from "@/lib/admin/bitacora";
import type { CategoriaComunidad } from "@/lib/comunidad-tipos";

/**
 * Cola de moderación de Comunidad: lo que `comunidad_moderacion` NO es
 * (esa es evidencia de lo ya eliminado). Se lee siempre desde el layout de
 * `/admin` (rol ya verificado ahí, ver src/app/(admin)/admin/layout.tsx),
 * y RLS (090_comunidad_reportes.sql) igual restringe el SELECT a admins —
 * doble capa, mismo criterio que el resto del panel.
 *
 * Sin paginación a propósito: es una cola de trabajo pendiente, no un
 * historial — se espera que se vacíe seguido, a diferencia de la bitácora
 * (que sí crece sin límite y por eso pagina). Si el volumen real termina
 * siendo mayor al esperado, se le agrega paginación entonces.
 */
export type ReporteDeContenido = {
  id: string;
  motivo: string;
  reportanteNombre: string;
  /** Días de calendario (Colombia) desde el reporte: 0 es hoy. */
  dias: number;
};

/**
 * Un contenido con todos sus reportes pendientes: si tres personas reportan
 * la misma publicación, el admin decide una vez. Eliminar ya cerraba todos
 * los reportes del contenido (eliminar.ts); dejarlo también.
 */
export type ContenidoReportado = {
  tipoContenido: "publicación" | "respuesta";
  /** Id del post o la respuesta reportada (según `tipoContenido`). */
  contenidoId: string;
  /** Slug del post al que pertenece (el mismo post si es una publicación), para enlazar al hilo. */
  postSlug: string;
  /** Título del post: el de la publicación misma o el de la que contesta la respuesta. */
  postTitulo: string;
  categoria: CategoriaComunidad | null;
  texto: string;
  autorNombre: string;
  autorSlug: string | null;
  diasPublicado: number;
  /** Contenidos de este autor que un admin ya eliminó; null si no se pudo leer. */
  eliminacionesPrevias: number | null;
  /** null si no se pudo leer. */
  adjuntos: { imagenes: number; archivos: number } | null;
  /** Del más antiguo al más reciente: el primero dice cuánto lleva esperando. */
  reportes: ReporteDeContenido[];
};

const LARGO_TEXTO = 600;

/** Días de calendario en Colombia entre dos instantes. */
export function diasEntre(desde: string, ahora: Date): number {
  const dia = (instante: string | Date) => new Date(`${diaEnColombia(instante)}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((dia(ahora) - dia(desde)) / 86_400_000));
}

export async function getReportesComunidadPendientes(): Promise<ContenidoReportado[]> {
  const supabase = await createClient();
  const ahora = new Date();

  const { data: reportes, error } = await supabase
    .from("comunidad_reportes")
    .select("id, id_post, id_respuesta, id_reportante, motivo, creado_en")
    .eq("revisado", false)
    .order("creado_en", { ascending: true });

  // Un fallo no es "sin reportes pendientes": la cola de moderación se vería
  // vacía justo cuando no se pudo leer.
  lanzarSiFalla(error, "comunidadReportes:comunidad_reportes");
  if (!reportes || reportes.length === 0) return [];

  const idsPost = [...new Set(reportes.filter((r) => r.id_post).map((r) => r.id_post as string))];
  const idsRespuesta = [...new Set(reportes.filter((r) => r.id_respuesta).map((r) => r.id_respuesta as string))];

  const [{ data: posts, error: errorPosts }, { data: respuestas, error: errorRespuestas }] = await Promise.all([
    idsPost.length
      ? supabase
          .from("comunidad_posts")
          .select("id, slug, id_usuario, titulo, contenido, categoria, creado_en, eliminado")
          .in("id", idsPost)
      : Promise.resolve({ data: [] as never[], error: null }),
    idsRespuesta.length
      ? supabase
          .from("comunidad_respuestas")
          .select("id, id_post, id_usuario, contenido, creado_en, eliminado")
          .in("id", idsRespuesta)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);
  lanzarSiFalla(errorPosts, "comunidadReportes:comunidad_posts+comunidad_respuestas");
  lanzarSiFalla(errorRespuestas, "comunidadReportes:comunidad_posts+comunidad_respuestas");

  const postsPorId = new Map((posts ?? []).map((p) => [p.id, p]));
  const respuestasPorId = new Map((respuestas ?? []).map((r) => [r.id, r]));

  // Una respuesta se muestra con el título y la categoría de su post, que no
  // siempre está entre los reportados.
  const idsPostPadre = [
    ...new Set((respuestas ?? []).map((r) => r.id_post as string).filter((id) => !postsPorId.has(id))),
  ];
  const { data: postsPadre, error: errorPostsPadre } = idsPostPadre.length
    ? await supabase.from("comunidad_posts").select("id, slug, titulo, categoria").in("id", idsPostPadre)
    : { data: [] as { id: string; slug: string; titulo: string; categoria: CategoriaComunidad }[], error: null };
  lanzarSiFalla(errorPostsPadre, "comunidadReportes:comunidad_posts");
  const hiloPorPostId = new Map<string, { slug: string; titulo: string; categoria: CategoriaComunidad }>(
    [...(posts ?? []), ...(postsPadre ?? [])].map((p) => [p.id, { slug: p.slug, titulo: p.titulo, categoria: p.categoria }]),
  );

  const idsAutor = [
    ...new Set([...(posts ?? []).map((p) => p.id_usuario as string), ...(respuestas ?? []).map((r) => r.id_usuario as string)]),
  ];
  const idsPerfiles = [...new Set([...reportes.map((r) => r.id_reportante as string), ...idsAutor])];

  // El historial del autor y los adjuntos solo dan contexto: si fallan, la
  // tarjeta sale sin esa línea y el fallo queda registrado.
  const [perfilesRes, postsEliminados, respuestasEliminadas, adjuntosPost, adjuntosRespuesta] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, slug").in("id", idsPerfiles),
    idsAutor.length
      ? supabase.from("comunidad_posts").select("id_usuario").eq("eliminado_por_admin", true).in("id_usuario", idsAutor)
      : Promise.resolve({ data: [] as { id_usuario: string }[], error: null }),
    idsAutor.length
      ? supabase.from("comunidad_respuestas").select("id_usuario").eq("eliminado_por_admin", true).in("id_usuario", idsAutor)
      : Promise.resolve({ data: [] as { id_usuario: string }[], error: null }),
    idsPost.length
      ? supabase.from("comunidad_adjuntos").select("id_post, es_imagen").in("id_post", idsPost)
      : Promise.resolve({ data: [] as { id_post: string; es_imagen: boolean }[], error: null }),
    idsRespuesta.length
      ? supabase.from("comunidad_adjuntos").select("id_respuesta, es_imagen").in("id_respuesta", idsRespuesta)
      : Promise.resolve({ data: [] as { id_respuesta: string; es_imagen: boolean }[], error: null }),
  ]);
  lanzarSiFalla(perfilesRes.error, "comunidadReportes:perfiles");
  const perfilesPorId = new Map((perfilesRes.data ?? []).map((p) => [p.id, p as { id: string; nombre: string; slug: string | null }]));

  const sinHistorial = registrarSiFalla(
    postsEliminados.error ?? respuestasEliminadas.error,
    "comunidadReportes:historial",
    "no se pudo leer cuánto contenido le eliminaron antes al autor",
  );
  const eliminacionesPorAutor = new Map<string, number>();
  for (const fila of [...(postsEliminados.data ?? []), ...(respuestasEliminadas.data ?? [])]) {
    eliminacionesPorAutor.set(fila.id_usuario, (eliminacionesPorAutor.get(fila.id_usuario) ?? 0) + 1);
  }

  const sinAdjuntos = registrarSiFalla(
    adjuntosPost.error ?? adjuntosRespuesta.error,
    "comunidadReportes:adjuntos",
    "no se pudieron contar los adjuntos del contenido reportado",
  );
  const adjuntosPorContenido = new Map<string, { imagenes: number; archivos: number }>();
  for (const fila of [
    ...(adjuntosPost.data ?? []).map((a) => ({ id: a.id_post as string, esImagen: a.es_imagen as boolean })),
    ...(adjuntosRespuesta.data ?? []).map((a) => ({ id: a.id_respuesta as string, esImagen: a.es_imagen as boolean })),
  ]) {
    const cuenta = adjuntosPorContenido.get(fila.id) ?? { imagenes: 0, archivos: 0 };
    if (fila.esImagen) cuenta.imagenes += 1;
    else cuenta.archivos += 1;
    adjuntosPorContenido.set(fila.id, cuenta);
  }

  // El post/respuesta reportado pudo haberse borrado por fuera de este
  // reporte (el propio autor, u otro reporte ya resuelto): no hay nada que
  // un admin pueda hacer con él, así que se cierra aquí en vez de dejar una
  // tarjeta muerta en la cola para siempre.
  const idsAAutoResolver: string[] = [];
  const porContenido = new Map<string, ContenidoReportado>();

  for (const r of reportes) {
    const esPost = Boolean(r.id_post);
    const post = r.id_post ? postsPorId.get(r.id_post) : undefined;
    const respuesta = r.id_respuesta ? respuestasPorId.get(r.id_respuesta) : undefined;
    const contenido = esPost ? post : respuesta;
    if (!contenido) continue;
    if (contenido.eliminado) {
      idsAAutoResolver.push(r.id);
      continue;
    }

    const reporte: ReporteDeContenido = {
      id: r.id,
      motivo: r.motivo,
      reportanteNombre: perfilesPorId.get(r.id_reportante)?.nombre ?? "Usuario eliminado",
      dias: diasEntre(r.creado_en, ahora),
    };
    const clave = `${esPost ? "p" : "r"}:${contenido.id}`;
    const existente = porContenido.get(clave);
    if (existente) {
      existente.reportes.push(reporte);
      continue;
    }

    const idPostHilo = esPost ? post!.id : respuesta!.id_post;
    const hilo = hiloPorPostId.get(idPostHilo);
    const autor = perfilesPorId.get(contenido.id_usuario);
    porContenido.set(clave, {
      tipoContenido: esPost ? "publicación" : "respuesta",
      contenidoId: contenido.id,
      // Sin slug (el post no se pudo leer) queda el UUID: la página de
      // detalle lo acepta y redirige.
      postSlug: hilo?.slug ?? idPostHilo,
      postTitulo: hilo?.titulo ?? "",
      categoria: hilo?.categoria ?? null,
      texto: (esPost ? post!.contenido : respuesta!.contenido).slice(0, LARGO_TEXTO),
      autorNombre: autor?.nombre ?? "Usuario eliminado",
      autorSlug: autor?.slug ?? null,
      diasPublicado: diasEntre(contenido.creado_en, ahora),
      eliminacionesPrevias: sinHistorial ? null : (eliminacionesPorAutor.get(contenido.id_usuario) ?? 0),
      adjuntos: sinAdjuntos ? null : (adjuntosPorContenido.get(contenido.id) ?? { imagenes: 0, archivos: 0 }),
      reportes: [reporte],
    });
  }

  if (idsAAutoResolver.length > 0) {
    const { error: errorAuto } = await supabase.from("comunidad_reportes").update({ revisado: true }).in("id", idsAAutoResolver);
    // Si falla, esos reportes ya no se muestran igual; se reintenta en la próxima carga.
    registrarSiFalla(errorAuto, "comunidadReportes:auto-resolver", "no se pudieron cerrar reportes de contenido ya eliminado");
  }

  return [...porContenido.values()];
}
