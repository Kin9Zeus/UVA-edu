"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTema } from "@/components/tema/TemaProvider";
import { cn } from "@/lib/utils";

/**
 * El ícono y el texto muestran el tema AL QUE SE VA A CAMBIAR, no el actual:
 * el botón dice lo que hace (CLAUDE.md §3.4), igual que un interruptor de luz
 * con la etiqueta "Encender".
 */
function textos(tema: "claro" | "oscuro") {
  return tema === "oscuro"
    ? { etiqueta: "Cambiar a tema claro", corto: "Tema claro", Icono: Sun }
    : { etiqueta: "Cambiar a tema oscuro", corto: "Tema oscuro", Icono: Moon };
}

/** Botón de solo ícono, 44×44, para las cabeceras públicas. */
export function SelectorTemaBoton({ className }: { className?: string }) {
  const { tema, alternarTema } = useTema();
  const { etiqueta, Icono } = textos(tema);

  return (
    <Button
      variant="uva-icon"
      size="auto"
      onClick={alternarTema}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn("size-11", className)}
    >
      <Icono className="size-[18px]" strokeWidth={2} aria-hidden="true" />
    </Button>
  );
}

/** Opción del menú de usuario (panel del estudiante y admin). No cierra el
 *  menú: así se ve el cambio y se puede deshacer con otro clic. */
export function SelectorTemaMenuItem({ className }: { className?: string }) {
  const { tema, alternarTema } = useTema();
  const { etiqueta, corto, Icono } = textos(tema);

  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={alternarTema}
      aria-label={etiqueta}
      className={className}
    >
      <Icono className="size-4" aria-hidden="true" />
      {corto}
    </DropdownMenuItem>
  );
}

/** Fila a ancho completo para el menú móvil del sitio público. */
export function SelectorTemaFila({ className }: { className?: string }) {
  const { tema, alternarTema } = useTema();
  const { etiqueta, corto, Icono } = textos(tema);

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={etiqueta}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 border-0 bg-transparent py-3 text-left text-[15px] text-uva-text hover:text-uva-accent-text",
        className,
      )}
    >
      <Icono className="size-[18px]" strokeWidth={2} aria-hidden="true" />
      {corto}
    </button>
  );
}
