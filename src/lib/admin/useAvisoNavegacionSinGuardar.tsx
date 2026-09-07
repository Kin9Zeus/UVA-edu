"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

/**
 * Confirma antes de salir de la pantalla cuando hay cambios sin guardar.
 *
 * `beforeunload` (usado en CursoDetalleView/LeccionEditorPanel) solo cubre
 * salidas REALES del navegador — cerrar la pestaña, recargar, escribir otra
 * URL. No dispara con la navegación interna de Next.js (un <Link>, como
 * "Volver a cursos" o el menú lateral), porque esa navegación nunca
 * descarga la página — solo cambia el árbol de React. Sin esto, el clic más
 * común para salir de la pantalla (el propio "Volver a cursos") pierde los
 * cambios sin avisar.
 *
 * Intercepta el click en fase de captura sobre cualquier <a> que apunte a
 * otra ruta, antes de que el propio manejador de Link de Next.js la reciba
 * (por eso stopImmediatePropagation, no solo preventDefault).
 *
 * El diálogo es el propio de la app (`ConfirmDialog`), no `window.confirm()`
 * — un confirm nativo se ve como "localhost:3000 dice…" en vez de un modal
 * de U.V.A, la misma inconsistencia que ContenidoTab.tsx ya había resuelto
 * para su propio caso. El componente que llama a este hook debe renderizar
 * el elemento devuelto en algún punto de su árbol.
 */
export function useAvisoNavegacionSinGuardar(sinGuardar: boolean) {
  const router = useRouter();
  const [destinoPendiente, setDestinoPendiente] = useState<string | null>(null);
  // Objeto mutable, no estado: el listener de click (fuera del ciclo de
  // render de React) necesita leer y limpiar el destino sin esperar a que
  // el componente vuelva a renderizar.
  const destinoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sinGuardar) return;

    function interceptarClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;

      let destino: URL;
      try {
        destino = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (destino.origin !== window.location.origin) return;
      if (destino.href === window.location.href) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      destinoRef.current = destino.href;
      setDestinoPendiente(destino.href);
    }

    document.addEventListener("click", interceptarClick, true);
    return () => document.removeEventListener("click", interceptarClick, true);
  }, [sinGuardar]);

  const dialog = (
    <ConfirmDialog
      open={destinoPendiente !== null}
      onOpenChange={(open) => {
        if (!open) setDestinoPendiente(null);
      }}
      title="Cambios sin guardar"
      description="Tienes cambios sin guardar. ¿Salir sin guardarlos?"
      confirmLabel="Salir sin guardar"
      onConfirm={() => {
        const destino = destinoRef.current;
        setDestinoPendiente(null);
        if (destino) router.push(destino);
      }}
    />
  );

  return dialog;
}
