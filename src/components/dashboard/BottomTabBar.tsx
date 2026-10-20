"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Users, TrendingUp, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Cinco accesos, en el mismo orden e íconos que el Sidebar de escritorio. La
// barra ocupa el ancho y cada ítem reparte el espacio: "Comunidad" (la palabra
// más larga) mide ~69 px a 12 px y ~63 px a 11 px, así que bajo 400 px de ancho
// los rótulos bajan a 11 px y bajo 340 px solo el ítem activo muestra el suyo
// (los demás conservan el nombre para lectores de pantalla). "Cuenta" lleva al
// perfil; Certificados, Notas y Suscripción siguen en el menú del avatar.
const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
  { href: "/dashboard/comunidad", label: "Comunidad", icon: Users },
  { href: "/dashboard/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/dashboard/perfil", label: "Cuenta", icon: User },
];

export function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 px-[max(0.5rem,env(safe-area-inset-left))] pb-[calc(env(safe-area-inset-bottom)+14px)] md:hidden"
    >
      <div className="mx-auto flex max-w-[440px] items-center rounded-full border border-uva-line-strong bg-uva-surface p-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid min-h-[50px] min-w-0 flex-1 content-center justify-items-center gap-0.5 rounded-full py-1 text-uva-text-muted transition-colors max-[339px]:aria-[current=page]:flex-[2]",
                // Activa: fondo magenta suave con ícono y texto en magenta.
                // `accent-text` (no `accent-ink`): en oscuro `accent-ink` es
                // un magenta casi puro y sobre este fondo queda por debajo de
                // AA para texto de 12 px; `accent-text` da más de 6:1 en los
                // dos temas.
                active && "bg-uva-accent-soft text-uva-accent-text",
              )}
            >
              <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
              <span className={cn("text-xs leading-tight max-[399px]:text-[11px]", active ? "font-extrabold" : "font-semibold max-[339px]:sr-only")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
