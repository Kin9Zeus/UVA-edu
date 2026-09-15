"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ComunidadRespuestaItem } from "@/components/dashboard/comunidad/ComunidadRespuestaItem";
import type { ComunidadRespuesta } from "@/lib/comunidad-tipos";

type Orden = "relevancia" | "reciente" | "antiguo";

const OPCIONES: { valor: Orden; label: string }[] = [
  { valor: "antiguo", label: "Más antiguo" },
  { valor: "reciente", label: "Más reciente" },
  { valor: "relevancia", label: "Relevancia" },
];

/**
 * Orden de las respuestas de un post — a diferencia del feed (que sí
 * necesita volver a pedirle al servidor, porque no todo el catálogo de
 * posts está en memoria), acá el hilo completo ya llegó entero con
 * getComunidadPost: reordenar es puro trabajo de cliente, sin roundtrip.
 * "Más antiguo" es el default — mismo orden cronológico que ya traía el
 * hilo antes de este filtro, así que no cambia el comportamiento de nadie
 * que no toque el control.
 */
export function ComunidadRespuestasList({
  respuestas,
  total,
  ruta,
  usuarioActualId,
  esAdmin,
}: {
  respuestas: ComunidadRespuesta[];
  /** Respuestas vivas — lo calcula el servidor descontando las eliminadas,
   * así que NO equivale a `respuestas.length`, que incluye sus lápidas. */
  total: number;
  ruta: string;
  usuarioActualId: string;
  esAdmin: boolean;
}) {
  const [orden, setOrden] = useState<Orden>("antiguo");

  const ordenadas = useMemo(() => {
    const copia = [...respuestas];
    if (orden === "relevancia") {
      // Empate por fecha (más antigua primero) para que dos respuestas sin
      // ninguna reacción no salten de posición en cada render.
      copia.sort(
        (a, b) =>
          b.totalReacciones - a.totalReacciones ||
          new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
      );
    } else if (orden === "reciente") {
      copia.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
    } else {
      copia.sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());
    }
    return copia;
  }, [respuestas, orden]);

  return (
    <div className="flex flex-col">
      {/* El selector de orden estaba solo, alineado a la derecha y con medio
          renglón vacío a su izquierda: nada decía dónde empezaba el hilo.
          Ahora es un encabezado de sección con su control al lado, el mismo
          patrón de `ComunidadFiltros` en el feed (etiqueta izquierda, orden
          derecha). `mb-1` y no `py-2`: el `divide-y` de abajo ya separa. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-base text-uva-text">
          {total} respuesta{total === 1 ? "" : "s"}
        </h2>
        <div role="group" aria-label="Ordenar respuestas" className="flex gap-0.5">
          {OPCIONES.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={orden === opcion.valor}
              onClick={() => setOrden(opcion.valor)}
              className={cn(
                "rounded-uva-sm px-2.5 py-1 text-[12px] font-semibold text-uva-text-muted transition-colors hover:text-uva-text",
                orden === opcion.valor && "bg-uva-hover text-uva-text",
              )}
            >
              {opcion.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-uva-divider border-t border-uva-divider">
        {ordenadas.map((respuesta) => (
          <ComunidadRespuestaItem
            key={respuesta.id}
            respuesta={respuesta}
            ruta={ruta}
            usuarioActualId={usuarioActualId}
            esAdmin={esAdmin}
          />
        ))}
      </div>
    </div>
  );
}
