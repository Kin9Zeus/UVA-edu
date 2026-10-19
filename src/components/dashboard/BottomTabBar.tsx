"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Users, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Cuatro accesos, en el mismo orden e íconos que el Sidebar de escritorio.
// Certificados, Perfil y Suscripción quedan en el dropdown del avatar
// (Header). Certificados cedió su lugar a Comunidad: solo se visita al
// terminar un curso, y también se llega desde el Perfil. Un quinto ítem no
// cabe: con "Comunidad" y "Certificados" juntos la burbuja mide 395 px y a
// 375 se sale de la pantalla.
const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
  { href: "/dashboard/comunidad", label: "Comunidad", icon: Users },
  { href: "/dashboard/progreso", label: "Progreso", icon: TrendingUp },
];

export function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] md:hidden"
    >
      <div className="flex items-center gap-0.5 rounded-full border border-uva-line-strong bg-uva-surface p-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid min-h-[50px] min-w-[66px] content-center justify-items-center gap-0.5 rounded-full px-1.5 py-1 text-uva-text-muted transition-colors min-[360px]:min-w-[74px]",
                // Activa: fondo magenta suave con ícono y texto en magenta.
                // `accent-text` (no `accent-ink`): en oscuro `accent-ink` es
                // un magenta casi puro y sobre este fondo queda por debajo de
                // AA para texto de 12 px; `accent-text` da más de 6:1 en los
                // dos temas.
                active && "bg-uva-accent-soft text-uva-accent-text",
              )}
            >
              <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
              <span className={cn("text-xs leading-tight", active ? "font-extrabold" : "font-semibold")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
