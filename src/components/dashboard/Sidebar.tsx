"use client";

import { useState } from "react";
import { guardarSidebarColapsado } from "@/lib/sidebar-preferencia";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Users,
  TrendingUp,
  Award,
  NotebookPen,
  User,
  CreditCard,
  PanelLeftClose,
  PanelLeft,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GraciaCard } from "@/components/dashboard/GraciaCard";
import { LogoUva } from "@/components/home/LogoUva";
import type { AccesoVigente } from "@/lib/dashboard-chrome";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navPrincipal = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
  { href: "/dashboard/comunidad", label: "Comunidad", icon: Users },
];

const navProgreso = [
  { href: "/dashboard/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/dashboard/certificados", label: "Certificados", icon: Award },
  { href: "/dashboard/notas", label: "Mis notas", icon: NotebookPen },
  { href: "/dashboard/perfil", label: "Perfil", icon: User },
  { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  badge?: string;
}) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Colapsado no hay texto visible: el tooltip solo aparece al pasar el
      // mouse, así que el nombre accesible tiene que ir en el propio enlace.
      aria-label={collapsed ? label : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-uva-md px-3 text-uva-cuerpo font-medium text-uva-text-muted transition-colors hover:bg-uva-hover hover:text-uva-text",
        active && "bg-uva-surface-2 font-bold text-uva-text shadow-[inset_3px_0_0_var(--uva-btn)]",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
      {!collapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
      {!collapsed && badge && (
        <span className="font-mono text-uva-detalle font-bold text-uva-text-muted">
          {badge}
        </span>
      )}
    </Link>
  );

  // Colapsado: el ícono solo no dice nada (estilo Platzi) — un tooltip al
  // pasar el mouse muestra la etiqueta sin tener que expandir el menú.
  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>
        {label}
        {badge && <span className="ml-1.5 text-uva-text-faint">{badge}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Bogota",
});

/** "Tu acceso": días que quedan y la fecha de fin, con la barra de lo que resta. */
function TarjetaAcceso({ acceso }: { acceso: AccesoVigente }) {
  // "12 nov 2026": día, mes corto y año, sin los "de" de es-CO.
  const partes = FORMATO_FECHA.formatToParts(new Date(acceso.hasta));
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value.replace(".", "") ?? "";
  const fecha = `${parte("day")} ${parte("month")} ${parte("year")}`;
  return (
    <div className="mx-3 mb-3 flex shrink-0 flex-col gap-2 rounded-uva-md border border-uva-divider p-3.5">
      <p className="flex items-center justify-between text-uva-detalle font-bold text-uva-text">
        Tu acceso
        <span className="font-mono text-uva-accent-ink">
          {acceso.diasRestantes} {acceso.diasRestantes === 1 ? "día" : "días"}
        </span>
      </p>
      <div aria-hidden="true" className="h-[5px] overflow-hidden rounded-full bg-uva-divider">
        <div className="h-full rounded-full bg-uva-btn" style={{ width: `${Math.round(acceso.restante * 100)}%` }} />
      </div>
      <p className="text-uva-detalle text-uva-text-muted">
        {acceso.esInvitacion ? "Invitación" : "Acceso"} hasta el {fecha}
      </p>
    </div>
  );
}

export function Sidebar({
  certificadosCount,
  diasGracia,
  colapsadoInicial = false,
  acceso = null,
}: {
  certificadosCount: number;
  diasGracia: number | null;
  /** Días que le quedan a un acceso vigente (tarjeta "Tu acceso"). */
  acceso?: AccesoVigente | null;
  /** Preferencia guardada (cookie), leída en el servidor para no parpadear. */
  colapsadoInicial?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(colapsadoInicial);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-uva-divider bg-uva-surface transition-[width] duration-150 md:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          // Mismo esquema de padding que `nav` (px-2.5) para que el botón de
          // colapsar quede centrado exactamente sobre los íconos de abajo —
          // con `px-4` (el de antes) el botón quedaba 6px a la izquierda del
          // centro real de los íconos colapsados.
          collapsed ? "justify-center px-3" : "justify-between pr-4 pl-5",
        )}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            aria-label="U.V.A., ir al inicio del panel"
            className="inline-flex min-h-11 items-center text-uva-text no-underline hover:no-underline"
          >
            <LogoUva className="h-[27px] w-[83px]" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            const siguiente = !collapsed;
            setCollapsed(siguiente);
            guardarSidebarColapsado(siguiente);
          }}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex size-11 shrink-0 items-center justify-center rounded-uva-sm text-uva-text-muted hover:bg-uva-hover hover:text-uva-text"
        >
          {collapsed ? (
            <PanelLeft className="size-[18px]" strokeWidth={1.9} />
          ) : (
            <PanelLeftClose className="size-[18px]" strokeWidth={1.9} />
          )}
        </button>
      </div>

      <TooltipProvider delay={150}>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label="Navegación principal">
          {navPrincipal.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {!collapsed && (
            <p className="mt-[18px] mb-1.5 px-3 text-uva-detalle font-bold text-uva-text-muted">
              Tu progreso
            </p>
          )}
          {collapsed && <div className="my-3 border-t border-uva-divider" />}

          {navProgreso.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              collapsed={collapsed}
              badge={
                item.href === "/dashboard/certificados"
                  ? String(certificadosCount).padStart(2, "0")
                  : undefined
              }
            />
          ))}
        </nav>
      </TooltipProvider>

      {/* Fuera del `nav` que scrollea: la tarjeta de gracia y Soporte deben
          quedarse siempre visibles al fondo del sidebar, no desplazarse con
          la lista de arriba. Cuando hay período de gracia, Soporte se corre
          debajo de esa tarjeta (no encima) — mismo lugar de siempre, solo
          empujado por el módulo que aparece arriba. */}
      {diasGracia !== null && !collapsed && (
        <div className="shrink-0 px-[19px] pt-[19px]">
          <GraciaCard diasGracia={diasGracia} />
        </div>
      )}

      {acceso && diasGracia === null && !collapsed && <TarjetaAcceso acceso={acceso} />}

      <div className="shrink-0 border-t border-uva-divider px-3 py-2">
        <TooltipProvider delay={150}>
          <NavLink
            href="/dashboard/soporte"
            label="Soporte"
            icon={HelpCircle}
            active={isActive("/dashboard/soporte")}
            collapsed={collapsed}
          />
        </TooltipProvider>
      </div>
    </aside>
  );
}
