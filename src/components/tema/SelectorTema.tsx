"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTema } from "@/components/tema/TemaProvider";
import { cn } from "@/lib/utils";

/**
 * El ícono y el texto muestran el tema AL QUE SE VA A CAMBIAR, no el actual:
 * el botón dice lo que hace (CLAUDE.md §3.4), igual que un interruptor de luz
 * con la etiqueta "Encender". Elegir aquí sobrescribe el tema del sistema
 * hasta que el usuario pida volver a él (las opciones "Usar tema del
 * sistema" de abajo).
 *
 * Las variantes para el menú de usuario de los paneles viven en
 * SelectorTemaMenu.tsx: traen el menú desplegable de base-ui, y este archivo
 * lo cargan también las cabeceras públicas, que no lo usan.
 */
export function textos(tema: "claro" | "oscuro") {
  return tema === "oscuro"
    ? { etiqueta: "Cambiar a tema claro", corto: "Tema claro", Icono: Sun }
    : { etiqueta: "Cambiar a tema oscuro", corto: "Tema oscuro", Icono: Moon };
}

export const TEXTO_SISTEMA = "Usar tema del sistema";

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

const OPCIONES_TEMA = [
  { valor: "claro", etiqueta: "Claro", Icono: Sun },
  { valor: "oscuro", etiqueta: "Oscuro", Icono: Moon },
  { valor: "sistema", etiqueta: "Sistema", Icono: Monitor },
] as const;

/** Tres botones (claro, oscuro, sistema) con el actual marcado, para el menú
 *  móvil del sitio público. Cada uno mide 44 px de alto. */
export function SelectorTemaTres({ className }: { className?: string }) {
  const { preferencia, elegirTema } = useTema();

  return (
    <div role="radiogroup" aria-label="Tema" className={cn("grid grid-cols-3 gap-2", className)}>
      {OPCIONES_TEMA.map(({ valor, etiqueta, Icono }) => {
        const activa = preferencia === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => elegirTema(valor)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-uva-md border-[1.5px] px-2 max-[359px]:[&>svg]:hidden text-uva-cuerpo font-semibold outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
              activa
                ? "border-uva-accent-ink bg-uva-accent-soft text-uva-accent-text"
                : "border-uva-line-strong text-uva-text hover:border-uva-text",
            )}
          >
            <Icono className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}
