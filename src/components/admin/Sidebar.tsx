"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FolderTree,
  GraduationCap,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth/logout";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/instructores", label: "Instructores", icon: GraduationCap },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
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
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-uva-divider bg-[#0B0B0D] transition-[width] duration-150",
        collapsed ? "w-[76px]" : "w-[236px]",
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="font-heading text-[18px] tracking-[.1em] text-uva-text">
              U.V.A<span className="text-uva-accent">.</span>
            </span>
            <span className="rounded-uva-xs bg-uva-accent-soft px-1.5 py-0.5 font-mono text-[9px] tracking-[.08em] text-uva-accent-text">
              ADMIN
            </span>
          </div>
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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5" aria-label="Navegación del panel admin">
        {nav.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </nav>

      <div className="border-t border-uva-divider px-2.5 py-3">
        <button
          type="button"
          onClick={() => logout()}
          aria-label="Cerrar sesión"
          className={cn(
            "flex w-full items-center gap-3 rounded-uva-md px-3.5 py-2.5 text-sm text-uva-text-muted hover:bg-[#1C1C20] hover:text-uva-text",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="size-[18px] shrink-0" strokeWidth={1.9} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
