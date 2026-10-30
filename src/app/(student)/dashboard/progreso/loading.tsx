import { EsqueletoRegion, Skeleton } from "@/components/ui/skeleton";

/** Mismo esqueleto que la pantalla (título, cifras, actividad y filas) para
 *  que nada salte al llegar los datos. */
export default function CargandoMisCursos() {
  return (
    <EsqueletoRegion
      etiqueta="Cargando tus cursos"
      className="mx-auto flex w-full max-w-uva flex-col gap-9 px-uva-margen py-7 lg:py-9"
    >
      <div className="grid gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 border-t border-uva-divider lg:grid-cols-4">
        {[0, 1, 2, 3].map((cifra) => (
          <div key={cifra} className="grid gap-2 px-[18px] py-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5 border-t border-uva-divider pt-5 lg:flex-row lg:items-center lg:gap-12">
        <div className="grid flex-1 gap-2.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="h-40 w-full lg:w-[400px]" />
      </div>
      <div className="grid gap-3.5">
        <Skeleton className="h-6 w-32" />
        <div className="border-b border-uva-divider">
          {[0, 1].map((fila) => (
            <div
              key={fila}
              className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-uva-divider py-3.5 max-[399px]:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[200px_minmax(0,1fr)_auto] md:gap-5"
            >
              <Skeleton className="aspect-video w-full rounded-uva-sm max-[399px]:hidden" />
              <div className="grid gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <Skeleton className="size-11 md:h-9 md:w-28" />
            </div>
          ))}
        </div>
      </div>
    </EsqueletoRegion>
  );
}
