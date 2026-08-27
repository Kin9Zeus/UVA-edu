"use client";

import { useState } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { SearchIcon, CrossIcon } from "@/components/home/icons";
import { cn } from "@/lib/utils";

export type CursoOpcion = {
  id: string;
  titulo: string;
  instructorNombre: string;
};

/**
 * Input de búsqueda de la página de catálogo: mientras se escribe solo
 * despliega un dropdown con las coincidencias (mismo criterio de título/
 * instructor que el filtro de CatalogoContent), sin ejecutar la búsqueda.
 * El filtro real solo se aplica al clickear (o confirmar con Enter sobre
 * una opción resaltada) una opción del dropdown.
 */
export function BuscadorInput({
  placeholder = "Buscar por curso o instructor",
  valorInicial = "",
  opciones,
  onBuscar,
  onTextoChange,
  mensajeVacio = "Sin resultados",
  className,
}: {
  placeholder?: string;
  valorInicial?: string;
  opciones: CursoOpcion[];
  onBuscar: (valor: string) => void;
  /** Cada tecla, sin esperar a que se elija una sugerencia — para quien
   * quiera reaccionar al texto en vivo (con su propio debounce) sin
   * cambiar el comportamiento del dropdown en sí. */
  onTextoChange?: (valor: string) => void;
  mensajeVacio?: string;
  className?: string;
}) {
  const [texto, setTexto] = useState(valorInicial);

  function cambiarTexto(valor: string) {
    setTexto(valor);
    onTextoChange?.(valor);
  }

  function seleccionar(curso: CursoOpcion) {
    setTexto(curso.titulo);
    onBuscar(curso.titulo);
  }

  function limpiar() {
    setTexto("");
    onBuscar("");
  }

  return (
    <Autocomplete.Root
      items={opciones}
      value={texto}
      onValueChange={cambiarTexto}
      itemToStringValue={(curso) => curso.titulo}
      filter={(curso, query) => {
        const termino = query.trim().toLowerCase();
        if (!termino) return false;
        return (
          curso.titulo.toLowerCase().includes(termino) ||
          curso.instructorNombre.toLowerCase().includes(termino)
        );
      }}
      autoHighlight
    >
      <div className={cn("relative", className)}>
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-uva-text-faint">
          <SearchIcon />
        </span>
        <Autocomplete.Input
          placeholder={placeholder}
          className="h-10 w-full min-w-0 rounded-uva-md border border-uva-divider bg-uva-surface py-2 pr-9 pl-9 text-sm text-uva-text caret-uva-accent outline-none placeholder:text-uva-text-faint hover:border-uva-text-faint focus-visible:border-uva-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-uva-accent"
        />
        {texto && (
          <button
            type="button"
            onClick={limpiar}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-uva-text-faint hover:text-uva-text"
          >
            <CrossIcon className="size-3" />
          </button>
        )}
      </div>

      <Autocomplete.Portal>
        <Autocomplete.Positioner className="isolate z-[60] outline-none" sideOffset={6}>
          <Autocomplete.Popup className="w-(--anchor-width) max-w-(--available-width) max-h-[min(320px,var(--available-height))] overflow-y-auto rounded-uva-md border border-uva-divider bg-uva-surface py-1 shadow-lg data-empty:p-0">
            <Autocomplete.Empty className="px-3.5 py-3 text-sm text-uva-text-faint">
              {mensajeVacio}
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(curso: CursoOpcion) => (
                <Autocomplete.Item
                  key={curso.id}
                  value={curso}
                  onClick={() => seleccionar(curso)}
                  className="flex cursor-default flex-col gap-0.5 px-3.5 py-2 text-sm outline-none select-none data-highlighted:bg-uva-accent-soft"
                >
                  <span className="text-uva-text">{curso.titulo}</span>
                  <span className="text-xs text-uva-text-faint">{curso.instructorNombre}</span>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
