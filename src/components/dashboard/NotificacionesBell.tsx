"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X, MessageCircle, Megaphone, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import {
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  eliminarNotificacion,
} from "@/actions/notificaciones";
import { urlNotificacion, mensajeNotificacion, type Notificacion } from "@/lib/notificaciones-tipos";
import { GraciaCard } from "@/components/dashboard/GraciaCard";

/** Ícono + tono por tipo — mismos 4 tonos que ya usan las categorías de
 * Comunidad (CATEGORIA_ESTILO, comunidad-tipos.ts), no una paleta nueva.
 * "Éxito" acá no significa "buena noticia" en términos humanos (moderar tu
 * contenido no lo es) sino "el sistema hizo lo que se esperaba de esa
 * acción" — de ahí que eliminar-por-reporte y moderación compartan tono
 * danger (algo tuyo se removió) y anuncio/respuesta usen tonos más neutros. */
const ESTILO_POR_TIPO: Record<Notificacion["tipo"], { Icono: typeof MessageCircle; tono: "success" | "warn" | "danger" | "neutral" }> = {
  COMUNIDAD_RESPUESTA: { Icono: MessageCircle, tono: "neutral" },
  COMUNIDAD_ANUNCIO: { Icono: Megaphone, tono: "success" },
  COMUNIDAD_MODERACION: { Icono: ShieldAlert, tono: "danger" },
  COMUNIDAD_REPORTE_ELIMINADO: { Icono: ShieldCheck, tono: "danger" },
  COMUNIDAD_REPORTE_DESCARTADO: { Icono: ShieldOff, tono: "neutral" },
};

const CLASES_TONO: Record<"success" | "warn" | "danger" | "neutral", string> = {
  success: "bg-uva-badge-success-bg text-uva-badge-success-fg",
  warn: "bg-uva-badge-warn-bg text-uva-badge-warn-fg",
  danger: "bg-uva-badge-danger-bg text-uva-badge-danger-fg",
  neutral: "bg-uva-badge-neutral-bg text-uva-badge-neutral-fg",
};

/**
 * Campana de notificaciones del header. Genérica: hoy dispara "te
 * respondieron un post" y "nuevo anuncio" (094/095), pero la UI ya no asume
 * un único tipo.
 *
 * En mobile es también la única campana: antes el aviso de período de
 * gracia (`diasGracia`) vivía en su propio ícono aparte (GraciaAlerta,
 * eliminado), así que por debajo de `md` aparecían dos campanas casi
 * idénticas en el header. Ahora, si hay período de gracia activo, su
 * tarjeta (GraciaCard — misma que la fija del Sidebar en desktop) se
 * antepone dentro de este mismo popover.
 *
 * El conteo/lista llegan ya resueltos del servidor (getDashboardChromeData)
 * en cada carga de página — sin tiempo real por ahora, mismo alcance MVP
 * que el resto de Comunidad. Se copian a estado local (`locales`) para que
 * quitar una con "×" se sienta inmediato sin esperar el roundtrip;
 * `router.refresh()` igual corre por detrás para que el punto rojo y el
 * resto de la app vean el conteo real.
 */
export function NotificacionesBell({
  notificaciones,
  noLeidas,
  diasGracia = null,
}: {
  notificaciones: Notificacion[];
  noLeidas: number;
  /** Si no es null, antepone el aviso de período de gracia al popover
   * (solo relevante en mobile: en desktop ese aviso ya vive en la tarjeta
   * fija del Sidebar, ver Header.tsx). */
  diasGracia?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [locales, setLocales] = useState(notificaciones);
  // Ajustar estado a partir de props DURANTE el render (patrón recomendado
  // de React, no un useEffect) — sin esto, tras cada router.refresh() la
  // lista se quedaría congelada en el valor con el que se montó el
  // componente la primera vez: una notificación nueva que llegó mientras
  // el popover estaba cerrado nunca aparecería sin recargar la página
  // entera.
  const [prevNotificaciones, setPrevNotificaciones] = useState(notificaciones);
  if (notificaciones !== prevNotificaciones) {
    setPrevNotificaciones(notificaciones);
    setLocales(notificaciones);
  }

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

  function quitar(notificacion: Notificacion) {
    setLocales((actuales) => actuales.filter((n) => n.id !== notificacion.id));
    startTransition(async () => {
      await eliminarNotificacion(notificacion.id);
      router.refresh();
    });
  }

  const graciaVencida = diasGracia !== null && diasGracia <= 0;
  const etiquetaGracia =
    diasGracia === null
      ? null
      : graciaVencida
        ? "tu plan venció"
        : `quedan ${diasGracia} ${diasGracia === 1 ? "día" : "días"} de tu período de gracia`;
  const etiquetaNoLeidas = noLeidas > 0 ? `${noLeidas} sin leer` : null;
  const ariaLabel =
    [etiquetaGracia, etiquetaNoLeidas].filter(Boolean).length > 0
      ? `Notificaciones — ${[etiquetaGracia, etiquetaNoLeidas].filter(Boolean).join(", ")}`
      : "Notificaciones";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-uva-sm text-uva-text hover:bg-[#1C1C20]"
      >
        <Bell className="size-5" strokeWidth={1.9} />
        {(diasGracia !== null || noLeidas > 0) && (
          <span
            className={`absolute top-1.5 right-1.5 flex size-2 rounded-full ring-2 ring-uva-bg ${
              graciaVencida ? "bg-uva-badge-danger-fg" : diasGracia !== null ? "bg-uva-accent-2" : "bg-uva-accent"
            }`}
          />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-50 outline-none" sideOffset={8} align="end">
          <Popover.Popup className="flex w-[320px] max-h-[420px] flex-col overflow-hidden rounded-uva-md border border-uva-divider bg-uva-surface shadow-lg outline-none">
            {diasGracia !== null && (
              // md:hidden: en desktop este mismo aviso ya vive en la
              // tarjeta fija del Sidebar — repetirlo aquí sería redundante.
              <div className="border-b border-uva-divider p-3.5 md:hidden">
                <GraciaCard diasGracia={diasGracia} />
              </div>
            )}

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
              {locales.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-[13px] text-uva-text-faint">
                  No tienes notificaciones todavía.
                </p>
              ) : (
                locales.map((notificacion) => {
                  const { Icono, tono } = ESTILO_POR_TIPO[notificacion.tipo];
                  return (
                    // Fila con dos hijos hermanos (Link + botón "×"), nunca
                    // un botón anidado dentro del Link: dos elementos
                    // interactivos uno dentro del otro es HTML inválido y
                    // complica que el clic en "×" no dispare también la
                    // navegación del Link.
                    <div
                      key={notificacion.id}
                      className="group flex items-start gap-1 border-b border-uva-divider last:border-b-0 hover:bg-uva-hover"
                    >
                      <Link
                        href={urlNotificacion(notificacion)}
                        onClick={() => alAbrirNotificacion(notificacion)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 px-3.5 py-2.5 text-[13px] text-uva-text"
                      >
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${CLASES_TONO[tono]}`}
                          aria-hidden
                        >
                          <Icono className="size-3.5" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-1.5">
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
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => quitar(notificacion)}
                        aria-label="Quitar notificación"
                        title="Quitar notificación"
                        className="mt-2 mr-2 shrink-0 rounded-uva-sm p-1 text-uva-text-faint opacity-0 hover:text-uva-text group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent pointer-coarse:opacity-100"
                      >
                        <X className="size-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
