import * as React from "react"

import { cn } from "@/lib/utils"

/* Mismos tokens que `Input`: borde 3:1, 16 px en táctil (el iPhone hace zoom
   con menos) y 14 px solo con puntero fino desde 640 px. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-uva-md border border-uva-line-strong bg-uva-surface px-3.5 py-2.5 text-base text-uva-text caret-uva-accent outline-hidden placeholder:text-uva-text-faint hover:border-uva-text-faint focus-visible:border-uva-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-uva-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-uva-error aria-invalid:ring-3 aria-invalid:ring-uva-error/20 sm:pointer-fine:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
