import { cn } from "@/lib/utils";

/**
 * `.card` del mockup del panel admin: superficie, borde de 1px, radio de 10px
 * y `padding:20px`. La separación interna se pasa por `className` porque el
 * mockup la ajusta en cada uso (4px en las métricas, 14px en los formularios).
 *
 * `flush` es el `.card` con `padding:0;overflow:hidden` que el mockup usa
 * cuando dentro va una tabla a sangre.
 *
 * Existe aparte de `ui/card.tsx` para no alterar el look del dashboard del
 * estudiante, que también lo consume y no entra en esta auditoría.
 */
export function AdminCard({
  flush = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { flush?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-uva-md border border-uva-divider bg-uva-surface text-uva-text",
        flush ? "gap-0 overflow-hidden p-0" : "gap-3.5 p-5",
        className,
      )}
      {...props}
    />
  );
}
