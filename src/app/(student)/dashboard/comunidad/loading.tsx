import { EsqueletoRegion, Skeleton } from "@/components/ui/skeleton";

/** Los bloques sobre el fondo usan `bg-uva-divider`: el tono por defecto
 * del esqueleto (`uva-surface-2`) casi no se distinguía del fondo oscuro.
 *
 * Mientras llega el muro: la misma
 * silueta que `ComunidadLayout` — título, píldoras, buscador y tarjetas —
 * para que la pantalla no se quede congelada ni salte al cargar. */
export default function CargandoComunidad() {
  return (
    <EsqueletoRegion etiqueta="Cargando publicaciones" className="mx-auto flex w-full max-w-uva flex-col px-uva-margen py-7 lg:py-9">
      <div className="mx-auto flex w-full min-w-0 flex-col gap-[22px] lg:max-w-[1060px] lg:gap-7">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-44 bg-uva-divider" />
          <Skeleton className="h-5 w-full max-w-md bg-uva-divider" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[20, 40, 44, 24].map((ancho) => (
            <Skeleton key={ancho} className="h-11 shrink-0 rounded-full bg-uva-divider sm:h-9" style={{ width: `${ancho * 4}px` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-x-10">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-11 w-full bg-uva-divider sm:h-9" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-7 w-36 rounded-full" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
          <div className="hidden lg:flex lg:flex-col lg:gap-4">
            <Skeleton className="h-11 w-full bg-uva-divider" />
            <Skeleton className="h-4 w-40 bg-uva-divider" />
            <Skeleton className="h-4 w-full bg-uva-divider" />
            <Skeleton className="h-4 w-3/4 bg-uva-divider" />
          </div>
        </div>
      </div>
    </EsqueletoRegion>
  );
}
