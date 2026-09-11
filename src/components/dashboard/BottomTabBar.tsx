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
      <div className="flex items-center gap-1 rounded-[26px] border border-uva-divider bg-[#18181B]/95 p-1.5 shadow-lg shadow-black/40 backdrop-blur">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
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
        })}
      </div>
    </nav>
  );
}
