import { createClient } from "@/lib/supabase/server";
import { tiempoRelativo } from "@/lib/admin/format";

export type Notificacion = {
  id: string;
  tipo: "COMUNIDAD_RESPUESTA";
  actorNombre: string;
  entidadTipo: "comunidad_post";
  entidadId: string;
  leida: boolean;
  tiempo: string;
};

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
  const { data: actores } = idsActor.length
    ? await supabase.from("perfiles").select("id, nombre").in("id", idsActor)
    : { data: [] as { id: string; nombre: string }[] };
  const nombrePorActorId = new Map((actores ?? []).map((a) => [a.id, a.nombre]));

  return filas.map((fila) => ({
    id: fila.id,
    tipo: fila.tipo as Notificacion["tipo"],
    actorNombre: (fila.id_actor && nombrePorActorId.get(fila.id_actor)) || "Alguien",
    entidadTipo: fila.entidad_tipo as Notificacion["entidadTipo"],
    entidadId: fila.entidad_id,
    leida: fila.leida,
    tiempo: tiempoRelativo(fila.creado_en),
  }));
}

/** A dónde lleva el clic en una notificación — un solo lugar para no
 * repetir el switch en cada componente que la muestre. */
export function urlNotificacion(notificacion: Pick<Notificacion, "entidadTipo" | "entidadId">): string {
  switch (notificacion.entidadTipo) {
    case "comunidad_post":
      return `/dashboard/comunidad/${notificacion.entidadId}`;
  }
}

/** Texto de la notificación — igual, un solo lugar por tipo. */
export function mensajeNotificacion(notificacion: Pick<Notificacion, "tipo" | "actorNombre">): string {
  switch (notificacion.tipo) {
    case "COMUNIDAD_RESPUESTA":
      return `${notificacion.actorNombre} respondió tu publicación`;
  }
}
