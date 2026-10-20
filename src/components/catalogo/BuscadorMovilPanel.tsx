"use client";

import type { RefObject } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { BuscadorHeaderInput } from "@/components/catalogo/BuscadorHeaderInput";
import { CrossIcon } from "@/components/home/icons";
import { cn } from "@/lib/utils";

/**
 * Overlay de búsqueda a pantalla completa que abre la lupa de
 * BuscadorMovilDialog, que lo carga aparte (ver ahí por qué); por eso no
 * tiene `Trigger` propio y le devuelve el foco a la lupa con `finalFocus`.
 * Reutiliza BuscadorHeaderInput tal cual: mismas sugerencias y misma
 * navegación, solo cambia dónde vive el input.
 */
export function BuscadorMovilPanel({
  open,
  onOpenChange,
  finalFocus,
  destino,
  placeholder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus: RefObject<HTMLElement | null>;
  destino: string;
  placeholder: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-uva-overlay/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          finalFocus={finalFocus}
          className={cn(
            "fixed inset-x-0 top-0 z-50 border-b border-uva-divider bg-uva-bg p-4 outline-none",
            "pt-[max(1rem,env(safe-area-inset-top))]",
            "data-open:animate-in data-open:slide-in-from-top-4 data-open:fade-in-0",
            "data-closed:animate-out data-closed:slide-out-to-top-4 data-closed:fade-out-0",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Buscar cursos</DialogPrimitive.Title>
          <div className="flex items-center gap-2">
            <BuscadorHeaderInput
              placeholder={placeholder}
              destino={destino}
              className="flex-1"
              autoFocus
              onNavegar={() => onOpenChange(false)}
            />
            <DialogPrimitive.Close
              render={<Button variant="uva-icon" size="icon" aria-label="Cerrar búsqueda" />}
            >
              <CrossIcon />
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
