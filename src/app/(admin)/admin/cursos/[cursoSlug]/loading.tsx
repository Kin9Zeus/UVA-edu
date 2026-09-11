import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoDetalleCurso() {
  return (
    <div className="flex flex-col gap-[18px]">
      <Skeleton className="h-4 w-[110px]" />

      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="aspect-video h-11 shrink-0" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-[220px]" />
          <Skeleton className="h-3.5 w-[140px]" />
        </div>
      </div>

      <div className="flex gap-4 border-b border-uva-divider pb-2.5">
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-4 w-[90px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>

      <div className="flex max-w-[640px] flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-[280px]" />
      </div>
    </div>
  );
}
