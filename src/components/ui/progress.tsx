"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

/** Barra de progreso. Base UI pone `role="progressbar"` y el valor; hay que
 *  pasar `aria-label` (qué progreso es) porque la barra sola no lo dice. El
 *  borde `line-strong` mantiene el contraste 3:1 de la pista en los dos temas. */
function Progress({
  className,
  value,
  ...props
}: ProgressPrimitive.Root.Props & { "aria-label": string }) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn("w-full", className)}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className="h-2 w-full overflow-hidden rounded-full border border-uva-line-strong bg-uva-surface-2"
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full rounded-full bg-uva-accent motion-safe:transition-[width]"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
