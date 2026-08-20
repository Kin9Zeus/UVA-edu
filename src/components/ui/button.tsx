import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Base: `.btn` del mockup del panel admin (design-spec/project/Uva - Panel
   Admin.dc.html). El mockup INVIERTE la jerarquia de shadcn/ui: el boton por
   defecto es neutro (superficie + borde) y el magenta es la excepcion, que
   solo se pide explicitamente con variant="primary" (`.btn-primary`).
   El foco es `outline:2px solid var(--accent)` con offset, no un ring. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-uva-md border border-transparent bg-clip-padding font-semibold whitespace-nowrap outline-none select-none focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-uva-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* `.btn` — neutro, el que usa el mockup para casi todo */
        default:
          "border-uva-divider bg-uva-surface text-uva-text hover:bg-uva-hover aria-expanded:bg-uva-hover",
        /* `.btn-primary` — magenta, reservado al CTA de cada pantalla */
        primary:
          "border-uva-accent bg-uva-accent text-white hover:bg-uva-accent-hover",
        /* El mockup no distingue un `outline` del `.btn` base */
        outline:
          "border-uva-divider bg-uva-surface text-uva-text hover:bg-uva-hover aria-expanded:bg-uva-hover",
        secondary:
          "border-uva-divider bg-uva-surface text-uva-text hover:bg-uva-hover aria-expanded:bg-uva-hover",
        /* `.btn-ghost` */
        ghost:
          "border-transparent bg-transparent text-uva-text hover:bg-uva-hover aria-expanded:bg-uva-hover",
        /* `.btn-danger` — borde neutro y texto rojo, nunca relleno rojo */
        destructive:
          "border-uva-divider bg-transparent text-uva-error hover:bg-[color-mix(in_srgb,var(--uva-error)_12%,transparent)]",
        link: "border-transparent text-uva-accent underline-offset-4 hover:underline",
        /* U.V.A — variantes del sitio público (auth.css / home.css migrados).
           El original no define `transition` en .btn, así que se cancela la
           transition-all heredada de la base para no animar lo que antes
           cambiaba de forma instantánea. */
        "uva-primary":
          "w-full rounded-uva-md border border-transparent text-uva-text bg-uva-accent transition-none hover:bg-uva-accent-hover active:not-aria-[haspopup]:bg-uva-accent-active active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
        "uva-secondary":
          "w-full rounded-uva-md border border-uva-divider bg-transparent text-uva-text transition-none hover:bg-[#27272a] active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
        "uva-ghost":
          "w-full rounded-uva-md border border-transparent bg-transparent text-uva-accent transition-none hover:bg-uva-accent/10 active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
        "uva-icon":
          "rounded-uva-sm border-0 bg-transparent text-uva-text-faint !transition-none hover:text-uva-text-muted hover:bg-uva-text/8 active:not-aria-[haspopup]:!translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent [&_svg]:pointer-events-none",
      },
      size: {
        /* `.btn` — el mockup no fija alto: lo define el padding */
        default: "gap-[7px] px-4 py-2.5 text-[13.5px]",
        /* `.btn-sm` */
        sm: "gap-1.5 px-3 py-[7px] text-[12.5px] [&_svg:not([class*='size-'])]:size-3.5",
        xs: "gap-1 px-2.5 py-1 text-[12px] [&_svg:not([class*='size-'])]:size-3",
        lg: "gap-2 px-5 py-3 text-[14px]",
        /* Botones de solo icono: `.btn.btn-sm` con `padding:6px` */
        icon: "p-2.5",
        "icon-xs": "p-1 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "p-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "p-3",
        /* U.V.A — dimensiones compartidas de .btn (auth.css); primary ajusta alto/tipografía por className */
        uva: "min-h-11 gap-2.5 px-5 py-2 text-sm font-semibold",
        /* El tamaño exacto vive por completo en la className de cada uso (p.ej. botones ícono) */
        auto: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
