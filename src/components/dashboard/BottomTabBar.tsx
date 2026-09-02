"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, TrendingUp, Award, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Mismos 4 accesos que el Sidebar de escritorio (Inicio/Catálogo/Progreso/
// Certificados). Comunidad, Perfil y Suscripción quedan en el dropdown del
// avatar (Header) — no caben cómodos en una barra de 4-5 ítems.
const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
  { href: "/dashboard/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/dashboard/certificados", label: "Certificados", icon: Award },
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
