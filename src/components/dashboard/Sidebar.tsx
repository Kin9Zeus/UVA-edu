"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Users,
  TrendingUp,
  Award,
  User,
  CreditCard,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navPrincipal = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
  { href: "/dashboard/comunidad", label: "Comunidad", icon: Users },
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
  return (
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
        <span className="font-mono text-[11px] text-uva-text-faint tabular-nums">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ certificadosCount }: { certificadosCount: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-uva-divider bg-[#0B0B0D] transition-[width] duration-150",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <span className="font-heading text-[20px] tracking-[.1em] text-uva-text">
            U.V.A<span className="text-uva-accent">.</span>
          </span>
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
          <p className="mt-5 mb-1 px-3.5 font-mono text-[10px] tracking-[.22em] text-[#52525B] uppercase">
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
    </aside>
  );
}
