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
    <div className="flex flex-col items-center gap-2 rounded-uva-lg border border-uva-divider bg-uva-surface px-5 py-11 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-uva-surface-2 text-uva-accent-ink">
        <MessageSquarePlus className="size-7" strokeWidth={2} />
      </div>
      <h3 className="text-uva-titulo-4 font-extrabold text-uva-text">{titulo}</h3>
      <p className="max-w-[38ch] text-uva-cuerpo text-uva-text-muted">{texto}</p>
    </div>
  );
}
