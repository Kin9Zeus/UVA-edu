import { ComunidadAdjuntoArchivo } from "@/components/dashboard/comunidad/ComunidadAdjuntoArchivo";
import type { ComunidadAdjunto } from "@/lib/comunidad-tipos";

/**
 * Adjunto de un post o respuesta, imagen o archivo — usado tal cual en
 * `ComunidadPostCard` y `ComunidadRespuestaItem`, un solo lugar que decide
 * cómo se ve cada tipo para que no se desincronicen entre feed y detalle.
 *
 * La imagen nunca se recorta (`h-auto`, sin `object-cover`): se sirve ya
 * limitada en píxeles por `procesarAdjuntoComunidad` (nunca más de
 * 1600px de lado), así que acá solo hace falta que no desborde el ancho de
 * la tarjeta — `width`/`height` reales + `aspect-ratio` reservan el
 * espacio antes de que cargue, para no saltar el layout.
 */
export function ComunidadAdjuntoVista({ adjunto }: { adjunto: ComunidadAdjunto }) {
  if (adjunto.tipo === "archivo") return <ComunidadAdjuntoArchivo adjunto={adjunto} />;

  return (
    // URL firmada de corta duración (src/lib/comunidad.ts), no una ruta
    // estática que next/image pueda optimizar/cachear de forma útil.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={adjunto.url}
      alt=""
      width={adjunto.ancho}
      height={adjunto.alto}
      loading="lazy"
      style={{ aspectRatio: `${adjunto.ancho} / ${adjunto.alto}` }}
      className="h-auto w-full max-w-full rounded-uva-md border border-uva-divider object-contain"
    />
  );
}
