"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { MenuIcon, CrossIcon } from "@/components/home/icons";
import { cn } from "@/lib/utils";

const ENLACES = [
  { href: "/catalogo", label: "Cursos" },
  { href: "/#planes", label: "Precios" },
];

/**
 * Hamburguesa + panel de navegación para cuando el header no tiene espacio
 * para los links inline (headers públicos por debajo de min-[861px], ver
 * Header.tsx). Mismo patrón visual que BuscadorMovilDialog: panel a ancho
 * completo que baja desde el header, no un dropdown flotante.
 */
export function NavMovilDialog({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={<Button variant="uva-icon" size="icon" className={className} aria-label="Abrir menú" />}
      >
        <MenuIcon />
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
          <DialogPrimitive.Title className="sr-only">Menú</DialogPrimitive.Title>
          <div className="flex justify-end">
            <DialogPrimitive.Close
              render={<Button variant="uva-icon" size="icon" aria-label="Cerrar menú" />}
            >
              <CrossIcon />
            </DialogPrimitive.Close>
          </div>

          <nav className="flex flex-col" aria-label="Navegación">
            {ENLACES.map((enlace) => (
              <Link
                key={enlace.href}
                href={enlace.href}
                onClick={() => setOpen(false)}
                className="border-b border-uva-divider py-3 text-[15px] text-uva-text no-underline last:border-b-0 hover:text-uva-accent hover:no-underline"
              >
                {enlace.label}
              </Link>
            ))}
          </nav>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
