import { MessageSquarePlus } from "lucide-react";

/** Mismo estilo visual que `ComunidadPausada` (círculo de ícono + texto
 * centrado), para el feed sin publicaciones todavía — no es un bloqueo de
 * acceso, solo no hay nada que mostrar con el filtro actual. */
export function ComunidadEmptyState({
  categoria,
  soloPropios,
  busqueda,
}: {
  categoria?: string;
  soloPropios?: boolean;
  /** Cuando el vacío es por el texto buscado, no por la categoría/pestaña —
   * manda sobre los otros dos: da igual en qué categoría estés parado, lo
   * que importa es que esa búsqueda no encontró nada ahí. */
  busqueda?: string;
}) {
  const titulo = busqueda
    ? "No encontramos publicaciones"
    : soloPropios
      ? "Todavía no has publicado nada"
      : categoria
        ? "Todavía no hay publicaciones en esta categoría"
        : "Todavía no hay publicaciones aquí";
  const texto = busqueda
    ? `Ninguna publicación coincide con «${busqueda}» acá.`
    : soloPropios
      ? "Cuando publiques algo en la comunidad, aparecerá aquí."
      : "Sé el primero en compartir algo con la comunidad.";

  return (
    <div className="flex flex-col items-center gap-4 rounded-uva-md border border-uva-divider bg-uva-surface px-9 py-14 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-uva-accent-soft text-uva-accent">
        <MessageSquarePlus className="size-7" strokeWidth={2} />
      </div>
      <h3 className="text-lg text-uva-text">{titulo}</h3>
      <p className="max-w-[380px] text-sm text-uva-text-muted">{texto}</p>
    </div>
  );
}
