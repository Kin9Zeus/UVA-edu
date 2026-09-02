"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { BuscadorHeaderInput } from "@/components/catalogo/BuscadorHeaderInput";
import { SearchIcon, CrossIcon } from "@/components/home/icons";
import { cn } from "@/lib/utils";

/**
 * Botón de lupa + overlay de búsqueda a pantalla completa, para cuando el
 * header no tiene espacio para el input inline (headers públicos por debajo
 * de min-[861px], ver Header.tsx). Reutiliza BuscadorHeaderInput tal cual —
 * mismas sugerencias y misma navegación — solo cambia dónde vive el input.
 */
export function BuscadorMovilDialog({
  destino,
  placeholder = "¿Qué quieres aprender?",
  className,
}: {
  destino: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={<Button variant="uva-icon" size="icon" className={className} aria-label="Buscar" />}
      >
        <SearchIcon />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
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
              onNavegar={() => setOpen(false)}
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
