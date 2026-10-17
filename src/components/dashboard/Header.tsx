"use client";

import Link from "next/link";
import { BuscadorHeaderInput } from "@/components/catalogo/BuscadorHeaderInput";
import { NotificacionesBell } from "@/components/dashboard/NotificacionesBell";
import { MenuCuenta } from "@/components/dashboard/MenuCuenta";
import { cn } from "@/lib/utils";
import { LogoUva } from "@/components/home/LogoUva";
import type { Notificacion } from "@/lib/notificaciones-tipos";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { SelectorTemaBoton } from "@/components/tema/SelectorTema";

export function Header({
  nombre,
  fotoUrl = null,
  esAdmin = false,
  mostrarLogo = false,
  ocultarAccionesEnMobile = false,
  ocultarBuscador = false,
  diasGracia = null,
  notificaciones = [],
  notificacionesNoLeidas = 0,
}: {
  nombre: string;
  fotoUrl?: string | null;
  esAdmin?: boolean;
  /** `true`: se muestra siempre (ej. SiteHeader en /catalogo, /cursos, donde
   * no hay Sidebar con su propio logo en ningún ancho). `"solo-mobile"`: solo
   * se muestra por debajo de `md`, para el layout del dashboard, cuyo Sidebar
   * (con su propio logo) se oculta en mobile y reaparece desde `md`. */
  mostrarLogo?: boolean | "solo-mobile";
  /** El dashboard tiene su propia barra de navegación inferior en mobile
   * (BottomTabBar) con acceso directo a Catálogo, así que el buscador y el
   * link "Planes" del header sobran ahí por debajo de `md`. */
  ocultarAccionesEnMobile?: boolean;
  /** El reproductor de lección ya trae su propia barra (volver/temario/
   * siguiente clase): el buscador genérico ahí es ruido, no navegación
   * real — a diferencia del resto de páginas con este header, donde sí
   * hace falta. */
  ocultarBuscador?: boolean;
  /** Si no es null, antepone el aviso de período de gracia dentro del
   * popover de NotificacionesBell (solo relevante en mobile; en desktop
   * ese aviso vive en la tarjeta fija del Sidebar). */
  diasGracia?: number | null;
  /** Últimas notificaciones y cuántas siguen sin leer — ver
   * getDashboardChromeData (src/lib/dashboard-chrome.ts). `null` = no se
   * pudieron leer: la campana lo avisa en vez de decir que no hay ninguna. */
  notificaciones?: Notificacion[] | null;
  notificacionesNoLeidas?: number;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-1 border-b border-uva-divider bg-uva-bg/90 pr-2.5 pl-4 backdrop-blur md:gap-4 md:px-8">
      {mostrarLogo && (
        <Link
          href="/dashboard"
          aria-label="U.V.A., ir al inicio del panel"
          className={cn(
            "mr-auto inline-flex min-h-11 shrink-0 items-center text-uva-text no-underline hover:no-underline md:mr-0",
            mostrarLogo === "solo-mobile" && "md:hidden",
          )}
        >
          <LogoUva className="h-[25px] w-[77px]" />
        </Link>
      )}

      <div
        className={cn(
          "max-w-[420px] flex-1",
          ocultarAccionesEnMobile && "hidden md:block",
        )}
      >
        {!ocultarBuscador && (
          <BuscadorHeaderInput placeholder="¿Qué quieres aprender hoy?" destino="/dashboard/catalogo" />
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Visible siempre, no escondido en el menú de usuario. -my-0.5: área
            táctil de 44px sin crecer el header (lo fija el avatar, 40px). */}
        <SelectorTemaBoton className="-my-0.5 text-uva-text hover:bg-uva-hover hover:text-uva-text" />
        <NotificacionesBell
          notificaciones={notificaciones}
          noLeidas={notificacionesNoLeidas}
          diasGracia={diasGracia}
        />
        {PRECIOS_HABILITADOS && (
          <Link
            href="/dashboard/planes"
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold text-uva-text no-underline hover:bg-uva-hover",
              ocultarAccionesEnMobile && "hidden md:inline-block",
            )}
          >
            Planes
          </Link>
        )}
        <MenuCuenta nombre={nombre} fotoUrl={fotoUrl} esAdmin={esAdmin} />
      </div>
    </header>
  );
}
