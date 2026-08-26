import { AdminCard } from "@/components/admin/AdminCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoCursos() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-[160px]" />
        <Skeleton className="h-9 w-[140px]" />
        <Skeleton className="h-9 w-[140px]" />
        <Skeleton className="ml-auto h-9 w-[120px]" />
      </div>

      <AdminCard flush className="p-4">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
