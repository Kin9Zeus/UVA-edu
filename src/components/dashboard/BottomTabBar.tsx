"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Users, TrendingUp, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Cinco accesos, en el mismo orden e íconos que el Sidebar de escritorio. La
// barra ocupa el ancho (cada ítem reparte el espacio): a 375 px cada uno mide
// ~66 px y a 320 px ~57 px, ambos sobre los 44 px táctiles. "Cuenta" lleva al
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
      className="fixed inset-x-0 bottom-0 z-40 px-[max(0.75rem,env(safe-area-inset-left))] pb-[calc(env(safe-area-inset-bottom)+14px)] md:hidden"
    >
      <div className="mx-auto flex max-w-[440px] items-center gap-0.5 rounded-full border border-uva-line-strong bg-uva-surface p-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid min-h-[50px] min-w-0 flex-1 content-center justify-items-center gap-0.5 rounded-full px-0.5 py-1 text-uva-text-muted transition-colors",
                // Activa: fondo magenta suave con ícono y texto en magenta.
                // `accent-text` (no `accent-ink`): en oscuro `accent-ink` es
                // un magenta casi puro y sobre este fondo queda por debajo de
                // AA para texto de 12 px; `accent-text` da más de 6:1 en los
                // dos temas.
                active && "bg-uva-accent-soft text-uva-accent-text",
              )}
            >
              <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
              <span className={cn("text-xs leading-tight max-[359px]:text-[11px]", active ? "font-extrabold" : "font-semibold")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
