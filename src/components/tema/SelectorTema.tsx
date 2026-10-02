"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTema } from "@/components/tema/TemaProvider";
import { cn } from "@/lib/utils";

/**
 * El ícono y el texto muestran el tema AL QUE SE VA A CAMBIAR, no el actual:
 * el botón dice lo que hace (CLAUDE.md §3.4), igual que un interruptor de luz
 * con la etiqueta "Encender". Elegir aquí sobrescribe el tema del sistema
 * hasta que el usuario pida volver a él (las opciones "Usar tema del
 * sistema" de abajo).
 */
function textos(tema: "claro" | "oscuro") {
  return tema === "oscuro"
    ? { etiqueta: "Cambiar a tema claro", corto: "Tema claro", Icono: Sun }
    : { etiqueta: "Cambiar a tema oscuro", corto: "Tema oscuro", Icono: Moon };
}

const TEXTO_SISTEMA = "Usar tema del sistema";

/** Botón de solo ícono, 44×44, para las cabeceras. */
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

const CLASE_FILA =
  "flex min-h-11 w-full items-center gap-2.5 border-0 bg-transparent py-3 text-left text-[15px] text-uva-text hover:text-uva-accent-ink";

/** Fila a ancho completo para el menú móvil del sitio público. */
export function SelectorTemaFila({ className }: { className?: string }) {
  const { tema, alternarTema } = useTema();
  const { etiqueta, corto, Icono } = textos(tema);

  return (
    <button type="button" onClick={alternarTema} aria-label={etiqueta} className={cn(CLASE_FILA, className)}>
      <Icono className="size-[18px]" strokeWidth={2} aria-hidden="true" />
      {corto}
    </button>
  );
}

/** Vuelve a seguir `prefers-color-scheme`. Solo aparece cuando hay una
 *  elección manual: siguiendo ya al sistema no haría nada. */
export function SelectorTemaSistemaFila({ className }: { className?: string }) {
  const { preferencia, usarTemaDelSistema } = useTema();
  if (preferencia === "sistema") return null;

  return (
    <button type="button" onClick={usarTemaDelSistema} className={cn(CLASE_FILA, className)}>
      <Monitor className="size-[18px]" strokeWidth={2} aria-hidden="true" />
      {TEXTO_SISTEMA}
    </button>
  );
}

/** Igual que SelectorTemaSistemaFila, como opción del menú de usuario de los
 *  paneles. Cierra el menú: el botón sol/luna sigue a la vista en el header. */
export function SelectorTemaSistemaMenuItem({ className }: { className?: string }) {
  const { preferencia, usarTemaDelSistema } = useTema();
  if (preferencia === "sistema") return null;

  return (
    <DropdownMenuItem onClick={usarTemaDelSistema} className={className}>
      <Monitor className="size-4" aria-hidden="true" />
      {TEXTO_SISTEMA}
    </DropdownMenuItem>
  );
}
