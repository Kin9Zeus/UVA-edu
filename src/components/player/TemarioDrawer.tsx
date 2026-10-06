"use client";

import { Check, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { formatDuracion } from "@/lib/admin/format";
import type { LeccionPlayerItem } from "@/lib/leccion";

/**
 * Panel lateral "Progreso del curso" que abre el botón `Temario` de la barra
 * superior del reproductor. A diferencia de la tarjeta fija de la derecha,
 * agrupa las clases por módulo y muestra la miniatura de cada una.
 */
export function TemarioDrawer({
  abierto,
  onCerrar,
  lecciones,
  leccionActualId,
  completadas,
  total,
  porcentaje,
  onIrALeccion,
}: {
  abierto: boolean;
  onCerrar: () => void;
  lecciones: LeccionPlayerItem[];
  leccionActualId: string;
  completadas: number;
  total: number;
  porcentaje: number;
  onIrALeccion: (leccionId: string) => void;
}) {
  const modulos: { id: string; titulo: string; lecciones: LeccionPlayerItem[] }[] = [];
  for (const leccion of lecciones) {
    const ultimo = modulos.at(-1);
    if (ultimo && ultimo.id === leccion.moduloId) ultimo.lecciones.push(leccion);
    else modulos.push({ id: leccion.moduloId, titulo: leccion.moduloTitulo, lecciones: [leccion] });
  }

  return (
    <DialogPrimitive.Root open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-60 bg-uva-overlay/55" />
        <DialogPrimitive.Popup
          aria-label="Progreso del curso"
          className="fixed inset-y-0 right-0 z-60 h-full w-full overflow-auto border-l border-uva-divider bg-uva-surface p-[26px] outline-hidden sm:w-[430px]"
        >
        <div className="mb-1.5 flex items-center gap-2.5">
          <DialogPrimitive.Title
            render={<h4 />}
            className="m-0 font-heading text-[17px] font-bold tracking-[-0.03em] text-uva-text"
          >
            Progreso del curso
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Cerrar"
            className="ml-auto grid size-11 cursor-pointer place-items-center rounded-uva-md border-0 bg-transparent text-uva-text outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
          >
            <X className="size-4" strokeWidth={2.4} />
          </DialogPrimitive.Close>
        </div>

        <div className="mb-2.5 text-[12.5px] text-uva-text-muted">
          {porcentaje}% completado · {completadas} de {total} clases
        </div>
        <div className="mb-[22px] h-[7px] overflow-hidden rounded-full bg-uva-text/10">
          <div className="h-full rounded-full bg-uva-accent" style={{ width: `${porcentaje}%` }} />
        </div>

        {modulos.map((modulo) => (
          <div key={modulo.id}>
            <div className="mb-[9px] text-[10px] font-semibold tracking-[0.12em] text-uva-text-muted uppercase">
              {modulo.titulo}
            </div>
            <div className="mb-[22px] flex flex-col gap-[9px]">
              {modulo.lecciones.map((leccion) => {
                const esActual = leccion.id === leccionActualId;
                const completadaSinAbrir = leccion.completado && !esActual;
                return (
                  <button
                    key={leccion.id}
                    type="button"
                    onClick={() => onIrALeccion(leccion.id)}
                    className={`flex cursor-pointer items-center gap-[11px] rounded-uva-md border p-[9px] text-left outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent ${
                      esActual
                        ? "border-transparent bg-uva-accent/14"
                        : completadaSinAbrir
                          ? "border-uva-accent-2/35 bg-uva-accent-2-soft"
                          : "border-transparent bg-uva-text/5"
                    } `}
                  >
                    <div className="relative h-[38px] w-[62px] shrink-0 overflow-hidden rounded-uva-md bg-uva-surface-2">
                      {leccion.miniaturaUrl && (
                        <MiniaturaMux src={leccion.miniaturaUrl} className="absolute inset-0 size-full object-cover" />
                      )}
                      {completadaSinAbrir ? (
                        <div className="absolute inset-0 grid place-items-center bg-uva-bg/45">
                          <Check className="size-4 text-uva-accent-2" strokeWidth={3} />
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-uva-text">
                        {leccion.numero} · {leccion.titulo}
                      </div>
                      <div
                        className={`text-[11px] ${
                          completadaSinAbrir
                            ? "font-semibold text-uva-accent-2-text"
                            : "text-uva-text-muted"
                        } ${esActual ? "text-uva-text-muted" : ""}`}
                      >
                        {formatDuracion(leccion.duracion)}
                        {leccion.numero === 1 && total > 1 ? " · Introducción" : ""}
                        {esActual ? " · en curso" : leccion.completado ? " · clase completada" : ""}
                      </div>
                    </div>
                    {completadaSinAbrir ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-uva-accent-2 text-uva-on-bright">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
