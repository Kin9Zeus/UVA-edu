"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Ticket,
  FolderTree,
  GraduationCap,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth/logout";

// Los 4 de más uso a diario se quedan fijos en la burbuja (mismo criterio
// que BottomTabBar de estudiante). El resto del Sidebar (8 secciones en
// total, ver Sidebar.tsx) no cabe en una barra de 5 ítems con etiqueta, así
// que vive detrás de "Más".
const principales = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/codigos", label: "Códigos", icon: Ticket },
];

const secundarios = [
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/instructores", label: "Instructores", icon: GraduationCap },
  { href: "/admin/bitacora", label: "Bitácora", icon: ScrollText },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

function Burbuja({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-[18px] px-3.5 py-1.5 text-uva-text-faint transition-colors",
        active && "bg-uva-accent/15 text-uva-accent",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.2 : 1.9} />
      <span className="text-[10px] leading-none font-medium">{label}</span>
    </Link>
  );
}

export function AdminBottomTabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const enSecundario = secundarios.some((item) => isActive(item.href));

  return (
    <nav
      aria-label="Navegación del panel admin"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] md:hidden"
    >
      <div className="flex items-center gap-1 rounded-[26px] border border-uva-divider bg-[#18181B]/95 p-1.5 shadow-lg shadow-black/40 backdrop-blur">
        {principales.map((item) => (
          <Burbuja key={item.href} {...item} active={isActive(item.href)} />
        ))}

        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            aria-label="Más opciones"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-[18px] px-3.5 py-1.5 text-uva-text-faint transition-colors outline-none",
              enSecundario && "bg-uva-accent/15 text-uva-accent",
            )}
          >
            <Menu className="size-5" strokeWidth={enSecundario ? 2.2 : 1.9} />
            <span className="text-[10px] leading-none font-medium">Más</span>
          </DialogPrimitive.Trigger>

          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup
              className={cn(
                "fixed inset-x-0 bottom-0 z-50 rounded-t-[20px] border-t border-uva-divider bg-uva-bg p-4 outline-none",
                "pb-[max(1rem,env(safe-area-inset-bottom))]",
                "data-open:animate-in data-open:slide-in-from-bottom-4 data-open:fade-in-0",
                "data-closed:animate-out data-closed:slide-out-to-bottom-4 data-closed:fade-out-0",
              )}
            >
              <DialogPrimitive.Title className="sr-only">Más opciones del panel admin</DialogPrimitive.Title>
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-uva-divider" />

              <nav className="flex flex-col" aria-label="Más secciones">
                {secundarios.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 border-b border-uva-divider py-3 text-[15px] text-uva-text no-underline last:border-b-0 hover:no-underline",
                      isActive(item.href) && "text-uva-accent",
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.9} />
                    {item.label}
                  </Link>
                ))}
              </nav>

              <button
                type="button"
                onClick={() => logout()}
                className="mt-3 flex w-full items-center gap-3 py-3 text-[15px] text-uva-badge-danger-fg"
              >
                <LogOut className="size-[18px] shrink-0" strokeWidth={1.9} />
                Cerrar sesión
              </button>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </nav>
  );
}
