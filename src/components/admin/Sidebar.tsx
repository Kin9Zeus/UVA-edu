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
  Ticket,
  ScrollText,
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
  { href: "/admin/codigos", label: "Códigos de invitación", icon: Ticket },
  { href: "/admin/bitacora", label: "Bitácora", icon: ScrollText },
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
      /* El mockup no dibuja barra de acento en el item activo: solo cambia el
         fondo a var(--surface) y el texto a var(--text). */
      className={cn(
        "flex items-center gap-3 rounded-uva-md px-3 py-2.5 text-sm font-medium text-uva-muted hover:bg-uva-hover",
        active && "bg-uva-surface text-uva-text",
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
        "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-uva-divider bg-[#0B0B0D] transition-[width] duration-150 md:flex",
        collapsed ? "w-[76px]" : "w-[236px]",
      )}
    >
      <div className="flex items-center gap-2 px-[18px] pt-[22px] pb-6">
        {!collapsed && (
          <Link href="/admin" className="flex items-center whitespace-nowrap no-underline hover:no-underline">
            <span className="font-heading text-[18px] font-bold tracking-[.08em] text-uva-text">
              U.V.A<span className="text-uva-accent">.</span>
            </span>
            {/* El mockup lo escribe como texto suelto, sin pildora de fondo */}
            <span className="ml-2 font-mono text-[10px] font-semibold tracking-[.1em] text-uva-muted-2">
              ADMIN
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="ml-auto flex shrink-0 items-center justify-center rounded-uva-md p-1.5 text-uva-muted-2 hover:bg-uva-hover"
        >
          {collapsed ? (
            <PanelLeft className="size-[17px]" strokeWidth={1.9} />
          ) : (
            <PanelLeftClose className="size-[17px]" strokeWidth={1.9} />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5" aria-label="Navegación del panel admin">
        {nav.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </nav>

      <div className="mt-auto border-t border-uva-divider px-2.5 py-3.5">
        <button
          type="button"
          onClick={() => logout()}
          aria-label="Cerrar sesión"
          className={cn(
            "flex w-full items-center gap-3 rounded-uva-md px-3 py-2.5 text-sm text-uva-muted hover:bg-uva-hover hover:text-uva-text",
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
