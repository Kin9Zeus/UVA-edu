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
  tipo: "COMUNIDAD_RESPUESTA" | "COMUNIDAD_ANUNCIO";
  actorNombre: string;
  entidadTipo: "comunidad_post";
  entidadId: string;
  /** Título del post al que apunta — null si se borró antes de que se
   * cargara la notificación. Enriquece el mensaje ("...publicó «X»") sin
   * obligar a abrirla para saber de qué se trata. */
  entidadTitulo: string | null;
  /** Slug del post, para enlazar sin mostrar el UUID — null en el mismo
   * caso que `entidadTitulo`. La tabla guarda solo `entidad_id`. */
  entidadSlug: string | null;
  leida: boolean;
  tiempo: string;
};

/** A dónde lleva el clic en una notificación — un solo lugar para no
 * repetir el switch en cada componente que la muestre. Sin slug (post ya
 * borrado) cae al UUID: la página de detalle lo acepta igual. */
export function urlNotificacion(
  notificacion: Pick<Notificacion, "entidadTipo" | "entidadId" | "entidadSlug">,
): string {
  switch (notificacion.entidadTipo) {
    case "comunidad_post":
      return `/dashboard/comunidad/${notificacion.entidadSlug ?? notificacion.entidadId}`;
  }
}

/** Texto de la notificación — igual, un solo lugar por tipo. */
export function mensajeNotificacion(
  notificacion: Pick<Notificacion, "tipo" | "actorNombre" | "entidadTitulo">,
): string {
  const titulo = notificacion.entidadTitulo ? ` «${notificacion.entidadTitulo}»` : "";
  switch (notificacion.tipo) {
    case "COMUNIDAD_RESPUESTA":
      return `${notificacion.actorNombre} respondió tu publicación${titulo}`;
    case "COMUNIDAD_ANUNCIO":
      return `${notificacion.actorNombre} publicó un anuncio${titulo}`;
  }
}
