"use client";

import { useEffect } from "react";

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
 */
export function useAvisoNavegacionSinGuardar(sinGuardar: boolean) {
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

      const continuar = window.confirm("Tienes cambios sin guardar. ¿Salir sin guardarlos?");
      if (!continuar) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    document.addEventListener("click", interceptarClick, true);
    return () => document.removeEventListener("click", interceptarClick, true);
  }, [sinGuardar]);
}
