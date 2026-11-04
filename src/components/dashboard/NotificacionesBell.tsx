"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import type { NotificacionesPanel } from "@/components/dashboard/NotificacionesPanel";
import type { Notificacion } from "@/lib/notificaciones-tipos";
import { useModuloDiferido } from "@/lib/useModuloDiferido";

export type PropsNotificaciones = {
  /** `null` = no se pudieron leer (no es lo mismo que "no tiene ninguna"). */
  notificaciones: Notificacion[] | null;
  noLeidas: number;
  /** Si no es null, antepone el aviso de período de gracia al popover
   * (solo relevante en mobile: en desktop ese aviso ya vive en la tarjeta
   * fija del Sidebar, ver Header.tsx). */
  diasGracia?: number | null;
};

export const CLASE_BOTON_CAMPANA =
  "relative -my-0.5 flex size-11 shrink-0 items-center justify-center rounded-uva-sm text-uva-text hover:bg-uva-hover";

/** Lo que dice el botón para un lector de pantalla: avisos de gracia y sin leer. */
export function etiquetaCampana(noLeidas: number, diasGracia: number | null) {
  const graciaVencida = diasGracia !== null && diasGracia <= 0;
  const etiquetaGracia =
    diasGracia === null
      ? null
      : graciaVencida
        ? "tu plan venció"
        : `quedan ${diasGracia} ${diasGracia === 1 ? "día" : "días"} de tu período de gracia`;
  const partes = [etiquetaGracia, noLeidas > 0 ? `${noLeidas} sin leer` : null].filter(Boolean);
  return partes.length > 0 ? `Notificaciones — ${partes.join(", ")}` : "Notificaciones";
}

/** Ícono y punto de aviso: lo mismo antes y después de cargar el popover. */
export function ContenidoCampana({ noLeidas, diasGracia }: { noLeidas: number; diasGracia: number | null }) {
  const graciaVencida = diasGracia !== null && diasGracia <= 0;
  return (
    <>
      <Bell className="size-5" strokeWidth={1.9} />
      {(diasGracia !== null || noLeidas > 0) && (
        <span
          className={`absolute top-1.5 right-1.5 flex size-2 rounded-full ring-2 ring-uva-bg ${
            graciaVencida ? "bg-uva-badge-danger-fg" : diasGracia !== null ? "bg-uva-accent-2" : "bg-uva-accent"
          }`}
        />
      )}
    </>
  );
}

let panel: Promise<typeof NotificacionesPanel> | null = null;
function cargarPanel() {
  panel ??= import("@/components/dashboard/NotificacionesPanel")
    .then((m) => m.NotificacionesPanel)
    .catch((error) => {
      panel = null;
      throw error;
    });
  return panel;
}

/**
 * Campana de notificaciones del header. El botón se pinta con la página; el
 * popover (base-ui Popover, con floating-ui y la lista) se carga con la
 * intención de usarlo (ver useModuloDiferido), igual que MenuCuenta. Si se
 * toca antes de que llegue, se abre al llegar.
 *
 * El conteo/lista llegan ya resueltos del servidor (getDashboardChromeData)
 * en cada carga de página; el detalle de cómo se muestran vive en
 * NotificacionesPanel.
 */
export function NotificacionesBell(props: PropsNotificaciones) {
  const { noLeidas, diasGracia = null } = props;
  const { modulo: Panel, pedir } = useModuloDiferido(cargarPanel);
  const [tocado, setTocado] = useState(false);
  // Si el botón simple tenía el foco (teclado) al llegar el popover, el
  // botón del popover lo recibe: si no, el foco se perdería al reemplazarlo.
  const [enfocado, setEnfocado] = useState(false);

  if (Panel) {
    return <Panel {...props} abiertoAlInicio={tocado} enfocarAlMontar={enfocado} />;
  }
  return (
    <button
      type="button"
      aria-label={etiquetaCampana(noLeidas, diasGracia)}
      aria-haspopup="dialog"
      aria-expanded={false}
      onPointerEnter={pedir}
      onPointerDown={pedir}
      onFocus={() => {
        setEnfocado(true);
        pedir();
      }}
      onBlur={() => setEnfocado(false)}
      onClick={() => {
        pedir();
        setTocado(true);
      }}
      className={CLASE_BOTON_CAMPANA}
    >
      <ContenidoCampana noLeidas={noLeidas} diasGracia={diasGracia} />
    </button>
  );
}
