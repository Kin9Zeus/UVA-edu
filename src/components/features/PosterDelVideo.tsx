import { MiniaturaMux } from "@/components/features/MiniaturaMux";

/**
 * Lo que se ve en el recuadro del video mientras el reproductor de Mux
 * todavía no está listo (descargando su código y pidiendo el token). Con
 * `posterUrl` es una imagen del video que llega con el HTML, así el LCP es
 * esa imagen y no el reproductor: el reproductor pesa ~290 KiB y llegaba a
 * pintar a los 8 s en móvil con Slow 4G. Mismo `aspect-video` que el
 * reproductor, para que no haya salto de diseño al reemplazarlo.
 */
export function PosterDelVideo({ posterUrl }: { posterUrl?: string | null }) {
  return (
    <div
      role="status"
      className="relative flex aspect-video items-center justify-center bg-uva-surface-2 text-sm text-uva-muted-2"
    >
      {posterUrl && (
        <MiniaturaMux
          src={posterUrl}
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <span
        className={
          posterUrl
            ? "relative rounded-full bg-uva-bg/80 px-3 py-1 text-xs text-uva-text"
            : "relative"
        }
      >
        Cargando video…
      </span>
    </div>
  );
}
