import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Base: `.btn` del mockup del panel admin (design-spec/project/Uva - Panel
   Admin.dc.html). El mockup INVIERTE la jerarquia de shadcn/ui: el boton por
   defecto es neutro (superficie + borde) y el magenta es la excepcion, que
   solo se pide explicitamente con variant="primary" (`.btn-primary`).
   El foco es `outline:2px solid var(--accent)` con offset, no un ring. */
/* Área táctil mínima de 44 px (piso de calidad, CLAUDE.md 3.4) sin engordar la
   densidad de escritorio: solo en pantallas angostas (< 640 px) o con puntero
   táctil. El alto de escritorio de cada tamaño no cambia. */
const TACTIL_ALTO = "max-sm:min-h-11 pointer-coarse:min-h-11"
const TACTIL_CUADRADO =
  "max-sm:min-h-11 max-sm:min-w-11 pointer-coarse:min-h-11 pointer-coarse:min-w-11"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-uva-md border border-transparent bg-clip-padding font-semibold whitespace-nowrap outline-hidden select-none focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-uva-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* `.btn` — neutro, el que usa el mockup para casi todo */
        default:
          "border-uva-divider bg-uva-surface text-uva-text hover:bg-uva-hover aria-expanded:bg-uva-hover",
        /* `.btn-primary` — magenta, reservado al CTA de cada pantalla */
        primary:
          "border-uva-btn bg-uva-btn text-uva-on-accent hover:bg-uva-btn-hover hover:border-uva-btn-hover active:bg-uva-btn-active",
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
        link: "border-transparent text-uva-accent-ink underline-offset-4 hover:underline",
        /* U.V.A — variantes del sitio público (auth.css / home.css migrados).
           El original no define `transition` en .btn, así que se cancela la
           transition-all heredada de la base para no animar lo que antes
           cambiaba de forma instantánea. */
        "uva-primary":
          "w-full rounded-uva-md border border-transparent text-uva-on-accent bg-uva-btn transition-none hover:bg-uva-btn-hover active:not-aria-[haspopup]:bg-uva-btn-active active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
        "uva-secondary":
          "w-full rounded-uva-md border border-uva-divider bg-transparent text-uva-text transition-none hover:bg-uva-chip active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
        "uva-ghost":
          "w-full rounded-uva-md border border-transparent bg-transparent text-uva-accent-ink transition-none hover:bg-uva-accent/10 active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
        "uva-icon":
          "rounded-uva-sm border-0 bg-transparent text-uva-text-faint !transition-none hover:text-uva-text-muted hover:bg-uva-text/8 active:not-aria-[haspopup]:!translate-y-0 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent [&_svg]:pointer-events-none",
      },
      size: {
        /* `.btn` — el mockup no fija alto: lo define el padding */
        default: `gap-[7px] px-4 py-2.5 text-[13.5px] ${TACTIL_ALTO}`,
        /* `.btn-sm` */
        sm: `gap-1.5 px-3 py-[7px] text-[12.5px] [&_svg:not([class*='size-'])]:size-3.5 ${TACTIL_ALTO}`,
        xs: `gap-1 px-2.5 py-1 text-[12px] [&_svg:not([class*='size-'])]:size-3 ${TACTIL_ALTO}`,
        lg: `gap-2 px-5 py-3 text-[14px] ${TACTIL_ALTO}`,
        /* Botones de solo icono: `.btn.btn-sm` con `padding:6px` */
        icon: "size-11 p-0",
        "icon-xs": `p-1 [&_svg:not([class*='size-'])]:size-3 ${TACTIL_CUADRADO}`,
        "icon-sm": `p-1.5 [&_svg:not([class*='size-'])]:size-3.5 ${TACTIL_CUADRADO}`,
        "icon-lg": `p-3 ${TACTIL_CUADRADO}`,
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
