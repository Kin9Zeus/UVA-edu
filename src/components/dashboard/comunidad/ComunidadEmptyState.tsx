import { MessageSquarePlus } from "lucide-react";
import { ComunidadNuevaPublicacionBoton } from "@/components/dashboard/comunidad/ComunidadNuevaPublicacion";

/** Mismo estilo visual que `ComunidadPausada` (círculo de ícono + texto
 * centrado), para el feed sin publicaciones todavía — no es un bloqueo de
 * acceso, solo no hay nada que mostrar con el filtro actual. Un vacío es una
 * invitación a publicar: trae el mismo botón que abre el formulario. */
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
      : "Sé el primero en publicar";
  const texto = busqueda
    ? `Ninguna publicación coincide con «${busqueda}» acá.`
    : soloPropios
      ? "Cuando publiques algo en la comunidad, aparecerá aquí."
      : categoria
        ? "Todavía no hay publicaciones en esta categoría."
        : "Comparte un proyecto, haz una pregunta o publica una oferta de empleo.";

  return (
    <div className="flex flex-col items-center gap-4 rounded-uva-md border border-uva-divider bg-uva-surface px-6 py-12 text-center sm:px-9 sm:py-14">
      <div className="flex size-16 items-center justify-center rounded-full bg-uva-accent-soft text-uva-accent-ink">
        <MessageSquarePlus className="size-7" strokeWidth={2} aria-hidden="true" />
      </div>
      <h3 className="text-uva-titulo-4 text-uva-text">{titulo}</h3>
      <p className="max-w-[380px] text-uva-detalle text-uva-text-muted">{texto}</p>
      <ComunidadNuevaPublicacionBoton variante="vacio" />
    </div>
  );
}
