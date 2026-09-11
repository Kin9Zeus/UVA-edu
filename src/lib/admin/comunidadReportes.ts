import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

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
export type ReporteComunidadPendiente = {
  id: string;
  motivo: string;
  creadoEn: string;
  reportanteNombre: string;
  tipoContenido: "publicación" | "respuesta";
  /** Id del post o la respuesta reportada (según `tipoContenido`). */
  contenidoId: string;
  /** Post al que pertenece — igual a `contenidoId` si `tipoContenido` es "publicación" — para armar el enlace al hilo. */
  postId: string;
  autorNombre: string;
  preview: string;
  /** El post/respuesta ya se eliminó (por este reporte o por otra vía) —
   * la fila sigue en la tabla (no hay FK ON DELETE que la borre a ella,
   * solo al reporte si se borrara el post) pero ya no hay nada que hacer. */
  contenidoEliminado: boolean;
};

export async function getReportesComunidadPendientes(): Promise<ReporteComunidadPendiente[]> {
  const supabase = await createClient();

  const { data: reportes, error } = await supabase
    .from("comunidad_reportes")
    .select("id, id_post, id_respuesta, id_reportante, motivo, creado_en")
    .eq("revisado", false)
    .order("creado_en", { ascending: true });

  if (error) {
    logError("comunidad:reportes", "no se pudieron leer los reportes pendientes", error);
    return [];
  }
  if (!reportes || reportes.length === 0) return [];

  const idsPost = reportes.filter((r) => r.id_post).map((r) => r.id_post as string);
  const idsRespuesta = reportes.filter((r) => r.id_respuesta).map((r) => r.id_respuesta as string);
  const idsReportante = reportes.map((r) => r.id_reportante);

  const [{ data: posts }, { data: respuestas }] = await Promise.all([
    idsPost.length
      ? supabase.from("comunidad_posts").select("id, id_usuario, titulo, contenido, eliminado").in("id", idsPost)
      : Promise.resolve({ data: [] as never[] }),
    idsRespuesta.length
      ? supabase.from("comunidad_respuestas").select("id, id_post, id_usuario, contenido, eliminado").in("id", idsRespuesta)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const postsPorId = new Map((posts ?? []).map((p) => [p.id, p]));
  const respuestasPorId = new Map((respuestas ?? []).map((r) => [r.id, r]));

  const idsAutor = [
    ...(posts ?? []).map((p) => p.id_usuario),
    ...(respuestas ?? []).map((r) => r.id_usuario),
  ];
  const idsPerfiles = [...new Set([...idsReportante, ...idsAutor])];
  const { data: perfiles } = idsPerfiles.length
    ? await supabase.from("perfiles").select("id, nombre").in("id", idsPerfiles)
    : { data: [] as { id: string; nombre: string }[] };
  const nombresPorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

  return reportes.flatMap((r): ReporteComunidadPendiente[] => {
    const esPost = Boolean(r.id_post);
    const post = r.id_post ? postsPorId.get(r.id_post) : undefined;
    const respuesta = r.id_respuesta ? respuestasPorId.get(r.id_respuesta) : undefined;
    // El post/respuesta pudo haberse borrado por fuera de este reporte
    // (otro reporte, o el propio autor) — la fila del reporte sigue viva.
    if (esPost && !post) return [];
    if (!esPost && !respuesta) return [];

    const autorId = esPost ? post!.id_usuario : respuesta!.id_usuario;
    const contenidoEliminado = esPost ? post!.eliminado : respuesta!.eliminado;
    const preview = esPost ? `${post!.titulo}\n${post!.contenido}`.slice(0, 200) : respuesta!.contenido.slice(0, 200);

    return [
      {
        id: r.id,
        motivo: r.motivo,
        creadoEn: r.creado_en,
        reportanteNombre: nombresPorId.get(r.id_reportante) ?? "Usuario eliminado",
        tipoContenido: esPost ? "publicación" : "respuesta",
        contenidoId: esPost ? r.id_post! : r.id_respuesta!,
        postId: esPost ? r.id_post! : respuesta!.id_post,
        autorNombre: nombresPorId.get(autorId) ?? "Usuario eliminado",
        preview,
        contenidoEliminado,
      },
    ];
  });
}
