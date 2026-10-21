import { EsqueletoRegion, Skeleton } from "@/components/ui/skeleton";

/**
 * Mientras llega la clase (al entrar o al pasar a la siguiente): la misma
 * disposición que LeccionMaqueta, para que nada salte al llegar el contenido.
 */
export default function CargandoLeccion() {
  return (
    <main id="contenido" tabIndex={-1} className="flex min-h-dvh flex-col bg-uva-bg">
      <EsqueletoRegion etiqueta="Cargando la clase" className="flex flex-1 flex-col">
        <div className="h-16 border-b border-uva-divider" />
        <div className="mx-auto grid w-full max-w-uva flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_clamp(340px,30vw,440px)]">
          <div className="flex min-w-0 flex-col gap-5 lg:px-10 lg:pt-7">
            <Skeleton className="mx-auto aspect-video w-full rounded-none bg-uva-surface lg:max-w-[calc((100dvh-9rem)*16/9)] lg:rounded-uva-lg" />
            <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-0">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-12 w-full lg:w-72" />
            </div>
          </div>
          <div className="hidden flex-col gap-5 border-l border-uva-divider px-7 pt-7 xl:flex">
            <Skeleton className="h-36" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </EsqueletoRegion>
    </main>
  );
}
