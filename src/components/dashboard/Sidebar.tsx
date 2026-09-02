"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  TrendingUp,
  Award,
  User,
  CreditCard,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GraciaCard } from "@/components/dashboard/GraciaCard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Comunidad se oculta hasta después del MVP (la feature aún no está activa).
const navPrincipal = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
];

const navProgreso = [
  { href: "/dashboard/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/dashboard/certificados", label: "Certificados", icon: Award },
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
      className={cn(
        "flex items-center gap-3 rounded-uva-md border-l-[3px] border-transparent px-3.5 py-2.5 text-sm text-uva-text-muted transition-colors hover:bg-[#1C1C20] hover:text-uva-text",
        active && "border-uva-accent bg-uva-surface text-uva-text",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.9} />
      {!collapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
      {!collapsed && badge && (
        <span className="font-mono text-[11px] font-medium tracking-[.1em] text-uva-text-faint tabular-nums">
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

export function Sidebar({
  certificadosCount,
  diasGracia,
}: {
  certificadosCount: number;
  diasGracia: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-uva-divider bg-[#0B0B0D] transition-[width] duration-150 md:flex",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div
        className={cn(
          "flex items-center py-5",
          // Mismo esquema de padding que `nav` (px-2.5) para que el botón de
          // colapsar quede centrado exactamente sobre los íconos de abajo —
          // con `px-4` (el de antes) el botón quedaba 6px a la izquierda del
          // centro real de los íconos colapsados.
          collapsed ? "justify-center px-2.5" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            className="font-heading text-[20px] font-bold tracking-[.1em] text-uva-text no-underline hover:no-underline"
          >
            U.V.A<span className="text-uva-accent">.</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex size-8 shrink-0 items-center justify-center rounded-uva-sm text-uva-text-faint hover:bg-[#1C1C20] hover:text-uva-text-muted"
        >
          {collapsed ? (
            <PanelLeft className="size-[18px]" strokeWidth={1.9} />
          ) : (
            <PanelLeftClose className="size-[18px]" strokeWidth={1.9} />
          )}
        </button>
      </div>

      <TooltipProvider delay={150}>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5" aria-label="Navegación principal">
          {navPrincipal.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {!collapsed && (
            <p className="mt-5 mb-1 px-3.5 font-mono text-[10px] font-semibold tracking-[.22em] text-[#52525B] uppercase">
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

      {diasGracia !== null && !collapsed && (
        <div className="p-[19px]">
          <GraciaCard diasGracia={diasGracia} />
        </div>
      )}
    </aside>
  );
}
