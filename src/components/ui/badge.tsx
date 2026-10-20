import { cva, type VariantProps } from "class-variance-authority"
import { Check, Lock } from "lucide-react"

import { cn } from "@/lib/utils"

/* Insignias de la plataforma. El estado no depende solo del color: completada
   y bloqueada llevan su ícono. Los colores de `completada` salen del mismo par
   `badge-success` del panel, con contraste AA en los dos temas. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-uva-detalle font-semibold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        nivel: "border-uva-line-strong bg-transparent text-uva-text",
        categoria: "border-transparent bg-uva-chip text-uva-text",
        bloqueada:
          "border-uva-divider bg-uva-badge-neutral-bg text-uva-badge-neutral-fg",
        completada:
          "border-transparent bg-uva-badge-success-bg text-uva-badge-success-fg",
      },
    },
    defaultVariants: { variant: "categoria" },
  }
)

const ICONO = { bloqueada: Lock, completada: Check } as const

function Badge({
  className,
  variant = "categoria",
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  const Icono = variant === "bloqueada" || variant === "completada" ? ICONO[variant] : null
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {Icono && <Icono aria-hidden="true" strokeWidth={2.5} />}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
