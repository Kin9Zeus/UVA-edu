"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import {
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from "@/actions/notificaciones";
import { urlNotificacion, mensajeNotificacion, type Notificacion } from "@/lib/notificaciones";

/**
 * Campana de notificaciones del header — mismo Popover que ya usaba
 * GraciaAlerta para el aviso de período de gracia, pero genérico: hoy solo
 * dispara "te respondieron un post" (comunidad_respuestas_notifica_autor,
 * 094_comunidad_notificaciones.sql), pero la UI ya no asume un único tipo.
 *
 * El conteo/lista llegan ya resueltos del servidor (getDashboardChromeData)
 * en cada carga de página — sin tiempo real por ahora, mismo alcance MVP
 * que el resto de Comunidad. `router.refresh()` tras marcar leído vuelve a
 * pedir esos datos para que el punto rojo se actualice.
 */
export function NotificacionesBell({
  notificaciones,
  noLeidas,
}: {
  notificaciones: Notificacion[];
  noLeidas: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function alAbrirNotificacion(notificacion: Notificacion) {
    setOpen(false);
    if (!notificacion.leida) {
      startTransition(async () => {
        await marcarNotificacionLeida(notificacion.id);
        router.refresh();
      });
    }
  }

  function marcarTodo() {
    startTransition(async () => {
      await marcarTodasNotificacionesLeidas();
      router.refresh();
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={noLeidas > 0 ? `Notificaciones — ${noLeidas} sin leer` : "Notificaciones"}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-uva-sm text-uva-text hover:bg-[#1C1C20]"
      >
        <Bell className="size-5" strokeWidth={1.9} />
        {noLeidas > 0 && (
          <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-uva-accent ring-2 ring-uva-bg" />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-50 outline-none" sideOffset={8} align="end">
          <Popover.Popup className="flex w-[320px] max-h-[420px] flex-col overflow-hidden rounded-uva-md border border-uva-divider bg-uva-surface shadow-lg outline-none">
            <div className="flex items-center justify-between border-b border-uva-divider px-3.5 py-2.5">
              <span className="text-sm font-semibold text-uva-text">Notificaciones</span>
              {noLeidas > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={marcarTodo}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-uva-accent-text hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Marcar todo como leído
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-[13px] text-uva-text-faint">
                  No tienes notificaciones todavía.
                </p>
              ) : (
                notificaciones.map((notificacion) => (
                  <Link
                    key={notificacion.id}
                    href={urlNotificacion(notificacion)}
                    onClick={() => alAbrirNotificacion(notificacion)}
                    className="block border-b border-uva-divider px-3.5 py-2.5 text-[13px] text-uva-text last:border-b-0 hover:bg-uva-hover"
                  >
                    <span className="flex items-start gap-2">
                      {!notificacion.leida && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-uva-accent" aria-hidden />
                      )}
                      <span className={notificacion.leida ? "text-uva-text-muted" : "text-uva-text"}>
                        {mensajeNotificacion(notificacion)}
                      </span>
                    </span>
                    <span className="mt-0.5 block pl-3.5 font-mono text-[11px] text-uva-text-faint">
                      {notificacion.tiempo}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
