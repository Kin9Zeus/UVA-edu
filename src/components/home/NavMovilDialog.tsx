"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "@/components/home/icons";
import { useModuloDiferido } from "@/lib/useModuloDiferido";
import type { NavMovilPanel } from "@/components/home/NavMovilPanel";

let panel: Promise<typeof NavMovilPanel> | null = null;
function cargarPanel() {
  panel ??= import("@/components/home/NavMovilPanel")
    .then((m) => m.NavMovilPanel)
    .catch((error) => {
      panel = null;
      throw error;
    });
  return panel;
}

/**
 * Hamburguesa + panel de navegación para cuando el header no tiene espacio
 * para los links inline (headers públicos por debajo de lg, ver
 * Header.tsx). Mismo patrón visual que BuscadorMovilDialog.
 *
 * El botón se pinta con la página; el panel (base-ui Dialog, que trae
 * floating-ui) se carga con la intención de usarlo (ver useModuloDiferido),
 * para no sumar su JavaScript al LCP de la portada (Lighthouse móvil,
 * 2026-10-20). Si se toca antes de que llegue, se abre al llegar.
 */
export function NavMovilDialog({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const { modulo: Panel, pedir } = useModuloDiferido(cargarPanel);

  return (
    <>
      <Button
        ref={boton}
        variant="uva-icon"
        size="icon"
        className={className}
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={open}
        // Se pide el panel con la intención (puntero encima, foco, dedo
        // abajo) para que llegue antes del clic.
        onPointerEnter={pedir}
        onPointerDown={pedir}
        onFocus={pedir}
        onClick={() => {
          pedir();
          setOpen(true);
        }}
      >
        <MenuIcon />
      </Button>
      {Panel && <Panel open={open} onOpenChange={setOpen} finalFocus={boton} />}
    </>
  );
}
