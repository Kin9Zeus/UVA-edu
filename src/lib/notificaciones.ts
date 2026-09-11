import { createClient } from "@/lib/supabase/server";
import { tiempoRelativo } from "@/lib/admin/format";
import type { Notificacion } from "@/lib/notificaciones-tipos";

export type { Notificacion };

/** Cuántas notificaciones sin leer tiene el usuario actual — para el punto
 * rojo de la campana. Liviano a propósito (`head: true`, sin traer filas):
 * se pide en cada carga del header. */
export async function contarNotificacionesNoLeidas(usuarioId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("id_usuario", usuarioId)
    .eq("leida", false);
  return count ?? 0;
}

/** Últimas notificaciones del usuario actual, para el desplegable de la
 * campana — no pagina: es una lista corta y efímera, no un historial (mismo
 * criterio que getReportesComunidadPendientes, src/lib/admin/comunidadReportes.ts). */
export async function getNotificaciones(usuarioId: string, limite = 20): Promise<Notificacion[]> {
  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("notificaciones")
    .select("id, tipo, id_actor, entidad_tipo, entidad_id, leida, creado_en")
    .eq("id_usuario", usuarioId)
    .order("creado_en", { ascending: false })
    .limit(limite);

  if (error || !filas || filas.length === 0) return [];

  const idsActor = [...new Set(filas.filter((f) => f.id_actor).map((f) => f.id_actor as string))];
  const idsPost = [...new Set(filas.filter((f) => f.entidad_tipo === "comunidad_post").map((f) => f.entidad_id))];
  const [{ data: actores }, { data: posts }] = await Promise.all([
    idsActor.length
      ? supabase.from("perfiles").select("id, nombre").in("id", idsActor)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    idsPost.length
      ? supabase.from("comunidad_posts").select("id, titulo, slug").in("id", idsPost)
      : Promise.resolve({ data: [] as { id: string; titulo: string; slug: string }[] }),
  ]);
  const nombrePorActorId = new Map((actores ?? []).map((a) => [a.id, a.nombre]));
  const tituloPorPostId = new Map((posts ?? []).map((p) => [p.id, p.titulo]));
  const slugPorPostId = new Map((posts ?? []).map((p) => [p.id, p.slug]));

  return filas.map((fila) => ({
    id: fila.id,
    tipo: fila.tipo as Notificacion["tipo"],
    actorNombre: (fila.id_actor && nombrePorActorId.get(fila.id_actor)) || "Alguien",
    entidadTipo: fila.entidad_tipo as Notificacion["entidadTipo"],
    entidadId: fila.entidad_id,
    entidadTitulo: tituloPorPostId.get(fila.entidad_id) || null,
    entidadSlug: slugPorPostId.get(fila.entidad_id) || null,
    leida: fila.leida,
    tiempo: tiempoRelativo(fila.creado_en),
  }));
}
