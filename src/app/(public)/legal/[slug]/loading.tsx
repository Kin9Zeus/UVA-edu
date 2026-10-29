import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoTextoLegal() {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      aria-busy="true"
      className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-uva-margen pt-10 pb-uva-seccion sm:pt-14"
    >
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-4 h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="mt-4 h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </main>
  );
}
