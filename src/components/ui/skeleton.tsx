import { cn } from "@/lib/utils";

/** Placeholder de carga: bloque con pulso, sin contenido. Ver shadcn/ui. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-uva-md bg-uva-surface-2", className)}
      {...props}
    />
  );
}

export { Skeleton };
