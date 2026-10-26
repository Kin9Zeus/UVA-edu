"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { PenLine, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComunidadComposer } from "@/components/dashboard/comunidad/ComunidadComposer";
import type { CategoriaComunidad } from "@/lib/comunidad-tipos";
import { cn } from "@/lib/utils";

/**
 * Un solo diálogo de "Nueva publicación" por pantalla y varios botones que
 * lo abren (flotante/riel y el del estado vacío), unidos por este handle de
 * Base UI: cada botón es un `Dialog.Trigger` aunque viva lejos del diálogo,
 * así el foco vuelve al botón que lo abrió al cerrarlo.
 */
const dialogoNuevaPublicacion = DialogPrimitive.createHandle();

const CLASE_BOTON =
  "inline-flex items-center justify-center gap-2.5 rounded-uva-md bg-uva-btn px-5 text-uva-cuerpo font-bold text-uva-on-accent hover:bg-uva-btn-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

/**
 * `variante="fija"`: la acción principal de la pantalla, siempre a la vista.
 * Antes de `lg` flota sobre el contenido (encima de la barra inferior en
 * celular); desde `lg` va arriba del riel, que ya es `sticky`.
 * `variante="vacio"`: dentro del estado vacío del muro.
 */
export function ComunidadNuevaPublicacionBoton({ variante }: { variante: "fija" | "vacio" }) {
  return (
    <DialogTrigger
      handle={dialogoNuevaPublicacion}
      className={cn(
        CLASE_BOTON,
        variante === "fija"
          ? "fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-30 h-13 shadow-uva-flotante md:right-8 md:bottom-8 lg:static lg:h-11 lg:w-full lg:shadow-none"
          : "h-11",
      )}
    >
      <PenLine className="size-5 shrink-0" aria-hidden="true" />
      Nueva publicación
    </DialogTrigger>
  );
}

export function ComunidadNuevaPublicacionDialogo({
  ruta,
  categoriaInicial,
  esAdmin,
}: {
  ruta: string;
  categoriaInicial?: CategoriaComunidad;
  esAdmin: boolean;
}) {
  return (
    <Dialog handle={dialogoNuevaPublicacion}>
      {/* Pantalla completa en celular (el teclado y el editor necesitan todo
          el alto); centrado y de 640 px desde `sm`. */}
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 max-sm:inset-0 max-sm:h-dvh max-sm:max-w-none max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 sm:max-h-[calc(100dvh-4rem)] sm:w-[640px]"
      >
        {/* Cerrar va en la fila del título (y no en la esquina del cuadro):
            alineado con él y de 44 px, el mismo tamaño en celular y escritorio. */}
        <div className="flex min-h-15 shrink-0 items-center justify-between gap-3 border-b border-uva-divider pr-2 pl-5">
          <DialogTitle className="text-uva-titulo-4 text-uva-text">Nueva publicación</DialogTitle>
          <DialogClose
            aria-label="Cerrar sin publicar"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-uva-sm text-uva-text-muted hover:bg-uva-hover hover:text-uva-text focus-visible:outline-2 focus-visible:outline-uva-accent"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogClose>
        </div>
        <ComunidadComposer
          ruta={ruta}
          categoriaInicial={categoriaInicial}
          esAdmin={esAdmin}
          onPublicado={() => dialogoNuevaPublicacion.close()}
        />
      </DialogContent>
    </Dialog>
  );
}
