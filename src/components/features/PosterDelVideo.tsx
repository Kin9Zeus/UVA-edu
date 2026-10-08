"use client";

import { Play } from "lucide-react";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";

/**
 * Lo que se ve en el recuadro del video mientras el reproductor de Mux
 * todavía no está listo (descargando su código y pidiendo el token). Con
 * `posterUrl` es una imagen del video que llega con el HTML, así el LCP es
 * esa imagen y no el reproductor: el reproductor pesa ~290 KiB y llegaba a
 * pintar a los 8 s en móvil con Slow 4G. Mismo `aspect-video` que el
 * reproductor, para que no haya salto de diseño al reemplazarlo.
 *
 * Con `onActivar` y `cargando` en falso es también un botón de play: el
 * reproductor se carga unos segundos después de la página (ver VideoFrame) y
 * quien toca el póster antes lo carga de inmediato.
 */
export function PosterDelVideo({
  posterUrl,
  onActivar,
  cargando = true,
}: {
  posterUrl?: string | null;
  onActivar?: () => void;
  cargando?: boolean;
}) {
  return (
    <div className="relative flex aspect-video items-center justify-center bg-uva-surface-2 text-sm text-uva-muted-2">
      {posterUrl && (
        <MiniaturaMux
          src={posterUrl}
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {onActivar && !cargando ? (
        <button
          type="button"
          onClick={onActivar}
          aria-label="Reproducir video"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid size-[64px] place-items-center rounded-full bg-uva-accent/90">
            <Play className="size-6 fill-uva-bg text-uva-bg" strokeWidth={0} aria-hidden />
          </span>
        </button>
      ) : (
        <span
          role="status"
          className={
            posterUrl ? "relative rounded-full bg-uva-bg/80 px-3 py-1 text-xs text-uva-text" : "relative"
          }
        >
          Cargando video…
        </span>
      )}
    </div>
  );
}
