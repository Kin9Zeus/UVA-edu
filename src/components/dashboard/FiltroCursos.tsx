"use client";

import { Fragment, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Filtro = "todos" | "en-curso" | "terminados";

const OPCIONES = [
  ["todos", "Todos"],
  ["en-curso", "En progreso"],
  ["terminados", "Completados"],
] as const;

/**
 * Lista de "Tus cursos" con el filtro Todos / En progreso / Completados. Las
 * filas llegan ya renderizadas desde el servidor (ProgresoContent); aquí solo
 * se elige cuáles mostrar. Con un solo grupo el filtro no aporta y se oculta.
 */
export function FiltroCursos({ filas }: { filas: { id: string; completado: boolean; fila: ReactNode }[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const hayAmbos = filas.some((f) => f.completado) && filas.some((f) => !f.completado);
  const visibles = filas.filter((f) => filtro === "todos" || (filtro === "terminados") === f.completado);

  return (
    <>
      {hayAmbos && (
        <div
          role="group"
          aria-label="Qué cursos mostrar"
          className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-uva-md border border-uva-divider bg-uva-surface p-1"
        >
          {OPCIONES.map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={filtro === valor}
              onClick={() => setFiltro(valor)}
              className={cn(
                "min-h-11 rounded-uva-sm px-2.5 text-uva-detalle font-semibold whitespace-nowrap text-uva-text-muted sm:px-3 md:pointer-fine:min-h-9",
                filtro === valor && "bg-uva-surface-2 font-bold text-uva-text",
              )}
            >
              {texto}
            </button>
          ))}
        </div>
      )}
      <ul className="border-b border-uva-divider">
        {visibles.map((f) => (
          <Fragment key={f.id}>{f.fila}</Fragment>
        ))}
      </ul>
    </>
  );
}
