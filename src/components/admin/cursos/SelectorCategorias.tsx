"use client";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * Selector de las categorías de un curso. Es múltiple porque
 * `curso_categorias` es una tabla puente muchos-a-muchos: un curso puede
 * estar en "BIM" y en "Gestión y Normativa" a la vez y aparecer en las dos
 * pantallas del catálogo.
 *
 * Lo comparten el formulario de creación y la pestaña Información del
 * detalle, para que la regla de "al menos una" y el orden de la lista no
 * se dupliquen en dos sitios.
 */
export function SelectorCategorias({
  categorias,
  seleccionadas,
  onChange,
  id = "curso-categorias",
}: {
  categorias: { id: string; nombre: string }[];
  seleccionadas: string[];
  onChange: (ids: string[]) => void;
  id?: string;
}) {
  function alternar(categoriaId: string, marcada: boolean) {
    onChange(
      marcada
        ? [...seleccionadas, categoriaId]
        : seleccionadas.filter((actual) => actual !== categoriaId),
    );
  }

  if (categorias.length === 0) {
    return (
      <p className="text-xs text-uva-text-faint">
        Todavía no hay categorías. Crea la primera en Admin → Categorías.
      </p>
    );
  }

  return (
    // `role="group"` + aria-labelledby en vez de fieldset/legend: el <legend>
    // no se puede alinear con el resto de los <Label> del formulario sin
    // pelearse con su posicionamiento nativo.
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="flex max-h-[180px] flex-col gap-0.5 overflow-auto rounded-uva-md border border-uva-divider p-2"
    >
      {categorias.map((categoria) => {
        const inputId = `${id}-${categoria.id}`;
        return (
          <label
            key={categoria.id}
            htmlFor={inputId}
            className="flex cursor-pointer items-center gap-2.5 rounded-uva-md px-2 py-1.5 text-[13.5px] text-uva-text hover:bg-uva-surface-2"
          >
            <Checkbox
              id={inputId}
              checked={seleccionadas.includes(categoria.id)}
              onCheckedChange={(marcada) => alternar(categoria.id, marcada === true)}
            />
            {categoria.nombre}
          </label>
        );
      })}
    </div>
  );
}
