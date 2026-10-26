"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

/**
 * Índice fijo de un documento legal (desde 1024 px): marca la cláusula que
 * se está leyendo. En celular el índice es un `<details>` del servidor, sin
 * esto.
 */
export function IndiceLegal({ secciones }: { secciones: { id: string; titulo: string }[] }) {
  const [actual, setActual] = useState(secciones[0]?.id);

  useEffect(() => {
    // La cláusula "actual" es la última cuyo título ya pasó la franja de
    // arriba de la pantalla (bajo el encabezado fijo).
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((entrada) => entrada.isIntersecting);
        if (visible) setActual(visible.target.id);
      },
      { rootMargin: "-96px 0px -70% 0px" },
    );
    for (const { id } of secciones) {
      const elemento = document.getElementById(id);
      if (elemento) observador.observe(elemento);
    }
    return () => observador.disconnect();
  }, [secciones]);

  return (
    <nav
      aria-labelledby="indice-legal"
      className="sticky top-24 hidden self-start rounded-uva-lg border border-uva-divider bg-uva-surface p-4 lg:block"
    >
      <h2 id="indice-legal" className="mb-1.5 text-uva-detalle font-bold text-uva-text-muted">
        En esta página
      </h2>
      <ol className="grid">
        {secciones.map(({ id, titulo }, i) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={id === actual ? "location" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-uva-xs text-uva-detalle text-uva-text-muted hover:text-uva-text aria-[current]:font-bold aria-[current]:text-uva-text",
                FOCO,
              )}
            >
              <span className="min-w-[1.4em] tabular-nums">{i + 1}</span>
              <span className="flex-1">{titulo}</span>
              {id === actual && <span aria-hidden="true" className="size-[7px] rounded-full bg-uva-accent" />}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
