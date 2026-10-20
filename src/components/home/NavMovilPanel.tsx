"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { CrossIcon } from "@/components/home/icons";
import { cn } from "@/lib/utils";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { SelectorTemaFila, SelectorTemaSistemaFila } from "@/components/tema/SelectorTema";

const ENLACES = [
  { href: "/catalogo", label: "Cursos" },
  ...(PRECIOS_HABILITADOS ? [{ href: "/#planes", label: "Precios" }] : []),
  { href: "/#verificar-certificado", label: "Verificar certificado" },
];

/**
 * Panel de navegación del header público por debajo de lg: baja desde el
 * header a ancho completo, no es un dropdown flotante. Lo abre el botón de
 * NavMovilDialog, que lo carga aparte (ver ahí por qué); por eso no tiene
 * `Trigger` propio y le devuelve el foco a ese botón con `finalFocus`.
 */
export function NavMovilPanel({
  open,
  onOpenChange,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus: RefObject<HTMLElement | null>;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-uva-overlay/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          finalFocus={finalFocus}
          className={cn(
            "fixed inset-x-0 top-0 z-50 border-b border-uva-line-strong bg-uva-surface px-5 pb-5 outline-none",
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
                onClick={() => onOpenChange(false)}
                className="flex min-h-13 items-center border-b border-uva-divider text-uva-titulo-4 font-semibold text-uva-text no-underline last:border-b-0 hover:text-uva-accent-ink hover:no-underline"
              >
                {enlace.label}
              </Link>
            ))}
          </nav>
          <SelectorTemaFila className="min-h-14 border-t border-uva-divider text-uva-titulo-4 font-semibold" />
          <SelectorTemaSistemaFila className="min-h-14 border-t border-uva-divider text-uva-titulo-4 font-semibold" />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
