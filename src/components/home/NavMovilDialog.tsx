"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { MenuIcon, CrossIcon } from "@/components/home/icons";
import { cn } from "@/lib/utils";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { SelectorTemaFila, SelectorTemaSistemaFila } from "@/components/tema/SelectorTema";

const ENLACES = [
  { href: "/catalogo", label: "Catálogo" },
  ...(PRECIOS_HABILITADOS ? [{ href: "/#planes", label: "Precios" }] : []),
  { href: "/#verificar-certificado", label: "Verificar certificado" },
];

// Mismo destino que "Tengo un código" de la portada: sin sesión el proxy lo
// manda a /login y de vuelta aquí.
const HREF_CODIGO = "/dashboard/suscripcion";

/**
 * Hamburguesa + panel de navegación para cuando el header no tiene espacio
 * para los links inline (headers públicos por debajo de lg, ver
 * Header.tsx). Mismo patrón visual que BuscadorMovilDialog: panel a ancho
 * completo que baja desde el header, no un dropdown flotante.
 */
export function NavMovilDialog({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const esActual = (href: string) => href === "/catalogo" && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={<Button variant="uva-icon" size="icon" className={className} aria-label="Abrir menú" />}
      >
        <MenuIcon />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-uva-overlay/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 top-0 z-50 border-b border-uva-line-strong bg-uva-surface pr-[max(1.25rem,env(safe-area-inset-right))] pb-5 pl-[max(1.25rem,env(safe-area-inset-left))] max-h-dvh overflow-y-auto outline-none",
            "pt-[max(1rem,env(safe-area-inset-top))]",
            "data-open:animate-in data-open:slide-in-from-top-4 data-open:fade-in-0",
            "data-closed:animate-out data-closed:slide-out-to-top-4 data-closed:fade-out-0",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Menú</DialogPrimitive.Title>
          <div className="flex justify-end">
            <DialogPrimitive.Close
              render={<Button variant="uva-icon" size="icon" aria-label="Cerrar menú" className="text-uva-text" />}
            >
              <CrossIcon />
            </DialogPrimitive.Close>
          </div>

          <nav className="flex flex-col" aria-label="Navegación">
            {ENLACES.map((enlace) => {
              const actual = esActual(enlace.href);
              return (
                <Link
                  key={enlace.href}
                  href={enlace.href}
                  aria-current={actual ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "relative flex min-h-13 items-center border-b border-uva-divider text-uva-titulo-4 font-semibold text-uva-text no-underline hover:text-uva-accent-ink hover:no-underline",
                    // Sección actual: barra de lámina a la izquierda.
                    actual &&
                      "pl-3.5 font-extrabold before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-sm before:bg-uva-accent-ink",
                  )}
                >
                  {enlace.label}
                </Link>
              );
            })}
          </nav>
          <div className="grid gap-2.5 py-4">
            <Button render={<Link href={HREF_CODIGO} onClick={() => setOpen(false)} />} nativeButton={false} variant="uva-primary" size="uva" className="min-h-11 text-uva-cuerpo">
              Tengo un código
            </Button>
            <Button render={<Link href="/login" onClick={() => setOpen(false)} />} nativeButton={false} variant="uva-secondary" size="uva" className="min-h-11 text-uva-cuerpo">
              Entrar
            </Button>
          </div>
          <SelectorTemaFila className="min-h-14 border-t border-uva-divider text-uva-titulo-4 font-semibold" />
          <SelectorTemaSistemaFila className="min-h-14 border-t border-uva-divider text-uva-titulo-4 font-semibold" />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
