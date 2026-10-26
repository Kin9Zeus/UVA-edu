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
  TicketPercent,
  FolderTree,
  Flag,
  CreditCard,
  ScrollText,
  User,
  LogOut,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth/logout";

// Los 4 de más uso a diario se quedan fijos en la barra (mismo aspecto que
// la del panel del estudiante). El resto del menú lateral no cabe en una
// barra de 5 ítems con etiqueta, así que vive detrás de "Más".
const principales = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/codigos", label: "Códigos", icon: Ticket },
];

// Mismo orden y nombres que el menú lateral (Sidebar.tsx).
const secundarios = [
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/comunidad", label: "Comunidad", icon: Flag },
  { href: "/admin/planes", label: "Planes", icon: CreditCard },
  { href: "/admin/cupones", label: "Cupones", icon: TicketPercent },
  { href: "/admin/bitacora", label: "Bitácora", icon: ScrollText },
  { href: "/admin/configuracion", label: "Perfil", icon: User },
];

// Ítems que reparten el ancho (flex-1): caben cinco desde 320 px. Activo en
// magenta suave con `accent-text`, que da AA a 12 px en los dos temas.
const ITEM =
  "grid min-h-[50px] min-w-0 flex-1 content-center justify-items-center gap-0.5 rounded-full py-1 text-uva-text-muted no-underline transition-colors hover:no-underline outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent";
const ITEM_ACTIVO = "bg-uva-accent-soft text-uva-accent-text";

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
      className={cn(ITEM, active && ITEM_ACTIVO)}
    >
      <Icon className="size-5" strokeWidth={1.9} aria-hidden />
      <span className="text-uva-etiqueta leading-tight">{label}</span>
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
      className="fixed inset-x-0 bottom-0 z-40 px-[max(0.5rem,env(safe-area-inset-left))] pb-[calc(env(safe-area-inset-bottom)+14px)] md:hidden"
    >
      <div className="mx-auto flex max-w-[440px] items-center rounded-full border border-uva-line-strong bg-uva-surface p-1">
        {principales.map((item) => (
          <Burbuja key={item.href} {...item} active={isActive(item.href)} />
        ))}

        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            aria-label="Más opciones"
            className={cn(ITEM, enSecundario && ITEM_ACTIVO)}
          >
            <Menu className="size-5" strokeWidth={1.9} aria-hidden />
            <span className="text-uva-etiqueta leading-tight">Más</span>
          </DialogPrimitive.Trigger>

          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-uva-overlay/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup
              className={cn(
                "fixed inset-x-0 bottom-0 z-50 rounded-t-uva-lg border-t border-uva-divider bg-uva-bg p-4 outline-none",
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
                      "flex min-h-12 items-center gap-3 border-b border-uva-divider text-uva-cuerpo text-uva-text no-underline last:border-b-0 hover:no-underline",
                      isActive(item.href) && "font-bold text-uva-accent-ink",
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
                className="mt-3 flex min-h-12 w-full items-center gap-3 text-uva-cuerpo text-uva-badge-danger-fg"
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
