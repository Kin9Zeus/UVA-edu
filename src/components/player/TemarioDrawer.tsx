"use client";

import type { RefObject } from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { FOCO, ListaTemario, type ExamenTemario } from "@/components/player/ListaTemario";
import type { LeccionPlayerItem } from "@/lib/leccion";
import { cn } from "@/lib/utils";

/**
 * "Progreso del curso" que abre el botón `Temario` del encabezado (celular y
 * tablet, hasta 1279 px; desde 1280 el temario es una pestaña de la columna lateral).
 * En celular sube desde abajo; desde 640 px entra por la derecha. Base UI
 * atrapa el foco, lo cierra con Esc y devuelve el foco al botón.
 *
 * Sin sesión (`sinSesion`, la clase gratis) no hay avance: se titula
 * "Temario del curso" y explica qué se abre con la cuenta.
 */
export function TemarioDrawer({
  abierto,
  onCerrar,
  lecciones,
  leccionActualId,
  completadas,
  total,
  porcentaje,
  hrefDe,
  examen = null,
  sinSesion,
  finalFocus,
}: {
  abierto: boolean;
  onCerrar: () => void;
  lecciones: LeccionPlayerItem[];
  leccionActualId: string;
  completadas: number;
  total: number;
  porcentaje: number;
  hrefDe: (leccion: LeccionPlayerItem) => string;
  examen?: ExamenTemario | null;
  /** Sin sesión: texto bajo el título en lugar del avance. */
  sinSesion?: { nota: string };
  /** El botón que lo abrió: recibe el foco al cerrar. */
  finalFocus?: RefObject<HTMLElement | null>;
}) {
  const titulo = sinSesion ? "Temario del curso" : "Progreso del curso";

  return (
    <DialogPrimitive.Root open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-60 bg-uva-overlay/55" />
        <DialogPrimitive.Popup
          aria-label={titulo}
          finalFocus={finalFocus}
          className={cn(
            "fixed z-60 overflow-auto bg-uva-surface p-[22px] pb-[max(22px,env(safe-area-inset-bottom))] outline-hidden sm:p-[26px]",
            // Celular: hoja que sube desde abajo, sin tapar el video del todo.
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-uva-lg border-t border-uva-divider",
            // Desde 640 px: panel a la derecha, a todo el alto.
            "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[430px] sm:rounded-none sm:border-t-0 sm:border-l",
          )}
        >
          <div className="mb-1.5 flex items-center gap-2.5">
            <DialogPrimitive.Title
              render={<h2 />}
              className="m-0 font-heading text-[17px] font-bold tracking-[-0.03em] text-uva-text"
            >
              {titulo}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Cerrar"
              className={cn(
                "ml-auto grid size-11 cursor-pointer place-items-center rounded-uva-md border-0 bg-transparent text-uva-text",
                FOCO,
              )}
            >
              <X className="size-4" strokeWidth={2.4} aria-hidden />
            </DialogPrimitive.Close>
          </div>

          {sinSesion ? (
            <p className="m-0 mb-[22px] text-[12.5px] text-uva-text-muted">{sinSesion.nota}</p>
          ) : total === 0 ? (
            // Sin clases con video no hay avance que medir: "0 de 0" no dice nada.
            <p className="m-0 mb-[22px] text-[12.5px] text-uva-text-muted">
              Tu avance aparece aquí cuando las clases del curso tengan su video.
            </p>
          ) : (
            <>
              <div className="mb-2.5 text-[12.5px] text-uva-text-muted">
                {porcentaje}% completado · {completadas} de {total} clases
              </div>
              <div className="mb-[22px] h-[7px] overflow-hidden rounded-full bg-uva-text/10">
                <div className="h-full rounded-full bg-uva-accent" style={{ width: `${porcentaje}%` }} />
              </div>
            </>
          )}

          <ListaTemario
            lecciones={lecciones}
            leccionActualId={leccionActualId}
            hrefDe={hrefDe}
            onElegir={onCerrar}
            examen={examen}
            sinSesion={Boolean(sinSesion)}
            total={total}
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
