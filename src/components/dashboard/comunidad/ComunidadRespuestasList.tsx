"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ComunidadRespuestaItem } from "@/components/dashboard/comunidad/ComunidadRespuestaItem";
import { ComunidadRespuestaComposer } from "@/components/dashboard/comunidad/ComunidadRespuestaComposer";
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
  postId,
}: {
  respuestas: ComunidadRespuesta[];
  /** Respuestas vivas — lo calcula el servidor descontando las eliminadas,
   * así que NO equivale a `respuestas.length`, que incluye sus lápidas. */
  total: number;
  ruta: string;
  usuarioActualId: string;
  esAdmin: boolean;
  postId: string;
}) {
  const [orden, setOrden] = useState<Orden>("antiguo");
  const [objetivo, setObjetivo] = useState<{
    id: string;
    nombre: string;
    esHija: boolean;
  } | null>(null);

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
      copia.sort(
        (a, b) =>
          new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
      );
    } else {
      copia.sort(
        (a, b) =>
          new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
      );
    }
    return copia;
  }, [respuestas, orden]);

  // Un solo nivel de hilo (126_comunidad_respuesta_a_respuesta.sql): las
  // principales siguen el orden elegido; sus respuestas, de más antigua a
  // más reciente, justo debajo.
  const nombresMencionables = [
    ...new Set(respuestas.map((r) => r.autorNombre)),
  ];
  const principales = ordenadas.filter((r) => !r.idRespuestaPadre);
  const hijasDe = (id: string) =>
    respuestas
      .filter((r) => r.idRespuestaPadre === id)
      .sort(
        (a, b) =>
          new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
      );

  const campoPara = (id: string, hiloEsHija: boolean) =>
    objetivo?.id === id ? (
      <div className="pb-3 pl-9">
        <ComunidadRespuestaComposer
          postId={postId}
          ruta={ruta}
          enHilo={{
            respuestaId: objetivo.id,
            nombre: objetivo.nombre,
            mencionar: hiloEsHija,
            onCerrar: () => setObjetivo(null),
          }}
        />
      </div>
    ) : null;

  return (
    <div className="flex flex-col">
      {/* El selector de orden estaba solo, alineado a la derecha y con medio
          renglón vacío a su izquierda: nada decía dónde empezaba el hilo.
          Ahora es un encabezado de sección con su control al lado, el mismo
          patrón de `ComunidadFiltros` en el feed (etiqueta izquierda, orden
          derecha). `mb-1` y no `py-2`: el `divide-y` de abajo ya separa. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-uva-cuerpo font-bold text-uva-text">
          {total} respuesta{total === 1 ? "" : "s"}
        </h2>
        <div
          role="group"
          aria-label="Ordenar respuestas"
          className="flex gap-0.5"
        >
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
        {principales.map((respuesta) => (
          <div key={respuesta.id}>
            <ComunidadRespuestaItem
              respuesta={respuesta}
              ruta={ruta}
              usuarioActualId={usuarioActualId}
              esAdmin={esAdmin}
              onResponder={() =>
                setObjetivo({
                  id: respuesta.id,
                  nombre: respuesta.autorNombre,
                  esHija: false,
                })
              }
            />
            {campoPara(respuesta.id, false)}
            {hijasDe(respuesta.id).map((hija) => (
              <div key={hija.id} className="ml-9">
                <ComunidadRespuestaItem
                  respuesta={hija}
                  ruta={ruta}
                  usuarioActualId={usuarioActualId}
                  esAdmin={esAdmin}
                  onResponder={() =>
                    setObjetivo({
                      id: hija.id,
                      nombre: hija.autorNombre,
                      esHija: true,
                    })
                  }
                  nombresMencionables={nombresMencionables}
                />
                {campoPara(hija.id, true)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
