import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// focus-within y no focus-visible: en type="date" Tab también para en el ícono
// del calendario (dentro del input), donde el campo deja de cumplir :focus.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-uva-md border border-uva-line-strong bg-uva-surface px-3.5 py-2 text-base text-uva-text caret-uva-accent outline-hidden placeholder:text-uva-text-faint hover:border-uva-text-faint focus-within:border-uva-accent focus-within:outline-solid focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-uva-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-uva-error aria-invalid:ring-3 aria-invalid:ring-uva-error/20 sm:pointer-fine:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
