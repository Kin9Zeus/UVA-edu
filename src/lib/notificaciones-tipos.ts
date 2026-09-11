/**
 * Tipo y helpers puros de notificaciones, separados de src/lib/notificaciones.ts
 * a propósito: ese archivo importa createClient de "@/lib/supabase/server"
 * (server-only, arrastra next/headers), y NotificacionesBell.tsx (componente
 * cliente) necesita urlNotificacion/mensajeNotificacion — un import de
 * VALOR desde ese archivo arrastraría next/headers entero al bundle del
 * navegador ("You're importing a module that depends on next/headers...").
 * Mismo motivo por el que comunidad-tipos.ts vive separado de comunidad.ts,
 * y avatar.ts de fotoPerfilServidor.ts.
 */

export type Notificacion = {
  id: string;
  tipo: "COMUNIDAD_RESPUESTA";
  actorNombre: string;
  entidadTipo: "comunidad_post";
  entidadId: string;
  leida: boolean;
  tiempo: string;
};

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
