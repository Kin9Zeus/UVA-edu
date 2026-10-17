import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Los tamaños de la escala de letra (`text-uva-display`, `text-uva-cuerpo`…,
// globals.css) son tamaños, no colores: sin esto tailwind-merge los toma por
// un color y borra el color del texto que venía antes (p. ej. el blanco de un
// botón primario) en vez del tamaño. Los radios `rounded-uva-*` tampoco los
// conoce: sin `theme.radius`, `cn("rounded-uva-md", "rounded-none")` dejaba
// los dos y ganaba el que viniera después en el CSS, no el pedido.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["uva-xs", "uva-sm", "uva-md", "uva-lg"],
    },
    classGroups: {
      "font-size": [
        { "text-uva": ["display", "titulo-1", "titulo-2", "titulo-3", "titulo-4", "lead", "cuerpo", "detalle"] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
