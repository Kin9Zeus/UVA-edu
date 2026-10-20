import { cn } from "@/lib/utils";

/** Placeholder de carga: bloque con pulso, sin contenido. Ver shadcn/ui. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse motion-reduce:animate-none rounded-uva-md bg-uva-surface-2", className)}
      {...props}
    />
  );
}

/** Agrupa los esqueletos de un bloque que carga: el lector de pantalla oye
 *  "Cargando" una vez (en vez de nada o de cada bloque) y los bloques, que son
 *  decorativos, se ocultan. */
function EsqueletoRegion({
  etiqueta = "Cargando",
  className,
  children,
}: {
  etiqueta?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{etiqueta}</span>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

export { Skeleton, EsqueletoRegion };
