import { EsqueletoRegion, Skeleton } from "@/components/ui/skeleton";

/** Mismo esqueleto que la pantalla (título, "Continuar donde quedaste" y
 *  filas) para que nada salte al llegar los datos. */
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
      <div className="grid gap-[18px] rounded-uva-lg border border-uva-divider bg-uva-surface p-5 md:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] md:items-center md:gap-8 md:p-6">
        <Skeleton className="aspect-video w-full" />
        <div className="grid gap-3.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-12 w-full md:w-52" />
        </div>
      </div>
      <div className="grid gap-1">
        <Skeleton className="mb-2 h-6 w-40" />
        {[0, 1].map((fila) => (
          <div
            key={fila}
            className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-uva-divider py-3.5 max-[399px]:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[160px_minmax(0,1fr)_auto] md:gap-5"
          >
            <Skeleton className="aspect-video w-full rounded-uva-sm max-[399px]:hidden" />
            <div className="grid gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <Skeleton className="size-11 md:h-9 md:w-28" />
          </div>
        ))}
      </div>
    </EsqueletoRegion>
  );
}
