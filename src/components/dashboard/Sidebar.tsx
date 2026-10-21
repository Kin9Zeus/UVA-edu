"use client";

import { useState } from "react";
import { guardarSidebarColapsado, type PreferenciaSidebar } from "@/lib/sidebar-preferencia";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Users,
  TrendingUp,
  Award,
  NotebookPen,
  User,
  CreditCard,
  PanelLeftClose,
  PanelLeft,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GraciaCard } from "@/components/dashboard/GraciaCard";
import { LogoUva } from "@/components/home/LogoUva";
import type { AccesoVigente } from "@/lib/dashboard-chrome";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navPrincipal = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
  { href: "/dashboard/comunidad", label: "Comunidad", icon: Users },
];

/**
 * Cómo se ve el menú: `compacto` (solo íconos), `completo`, o `auto`: solo
 * íconos por debajo de 1280 px y completo desde ahí. `auto` es el de quien
 * nunca tocó el botón: en una tableta o un iPad horizontal el menú completo
 * (256 px) dejaba la ficha del curso con una columna de 190 px. Se resuelve
 * con CSS (`max-xl:`) para que el servidor lo pinte bien sin saber el ancho.
 * Las clases van escritas enteras en cada caso para que Tailwind las vea.
 */
type Modo = "compacto" | "completo" | "auto";
const modoDe = (preferencia: PreferenciaSidebar): Modo =>
  preferencia === "colapsado" ? "compacto" : preferencia === "expandido" ? "completo" : "auto";

/** Lo que solo se ve con el menú completo. */
const SOLO_COMPLETO: Record<Modo, string> = { compacto: "hidden", completo: "", auto: "max-xl:hidden" };
/** Lo que solo se ve con el menú compacto. */
const SOLO_COMPACTO: Record<Modo, string> = { compacto: "", completo: "hidden", auto: "xl:hidden" };

const navProgreso = [
  { href: "/dashboard/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/dashboard/certificados", label: "Certificados", icon: Award },
  { href: "/dashboard/notas", label: "Mis notas", icon: NotebookPen },
  { href: "/dashboard/perfil", label: "Perfil", icon: User },
  { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  modo,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  modo: Modo;
  badge?: string;
}) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Compacto no hay texto visible: el tooltip solo aparece al pasar el
      // mouse, así que el nombre accesible tiene que ir en el propio enlace.
      aria-label={modo === "completo" ? undefined : label}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-uva-md px-3 text-uva-cuerpo font-medium text-uva-text-muted transition-colors hover:bg-uva-hover hover:text-uva-text",
        active && "bg-uva-surface-2 font-bold text-uva-text shadow-[inset_3px_0_0_var(--uva-btn)]",
        { compacto: "justify-center px-0", completo: "", auto: "max-xl:justify-center max-xl:px-0" }[modo],
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
      <span className={cn("flex-1 truncate", SOLO_COMPLETO[modo])}>{label}</span>
      {badge && (
        <span className={cn("font-mono text-uva-detalle font-bold text-uva-text-muted", SOLO_COMPLETO[modo])}>
          {badge}
        </span>
      )}
    </Link>
  );

  // Colapsado: el ícono solo no dice nada (estilo Platzi) — un tooltip al
  // pasar el mouse muestra la etiqueta sin tener que expandir el menú.
  if (modo === "completo") return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent className={SOLO_COMPACTO[modo]}>
        {label}
        {badge && <span className="ml-1.5 text-uva-text-faint">{badge}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Bogota",
});

/** "Tu acceso": días que quedan y la fecha de fin, con la barra de lo que resta. */
function TarjetaAcceso({ acceso }: { acceso: AccesoVigente }) {
  // "12 nov 2026": día, mes corto y año, sin los "de" de es-CO.
  const partes = FORMATO_FECHA.formatToParts(new Date(acceso.hasta));
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value.replace(".", "") ?? "";
  const fecha = `${parte("day")} ${parte("month")} ${parte("year")}`;
  return (
    <div className="mx-3 mb-3 flex shrink-0 flex-col gap-2 rounded-uva-md border border-uva-divider p-3.5">
      <p className="flex items-center justify-between text-uva-detalle font-bold text-uva-text">
        Tu acceso
        <span className="font-mono text-uva-accent-ink">
          {acceso.diasRestantes} {acceso.diasRestantes === 1 ? "día" : "días"}
        </span>
      </p>
      <div aria-hidden="true" className="h-[5px] overflow-hidden rounded-full bg-uva-divider">
        <div className="h-full rounded-full bg-uva-btn" style={{ width: `${Math.round(acceso.restante * 100)}%` }} />
      </div>
      <p className="text-uva-detalle text-uva-text-muted">
        {acceso.esInvitacion ? "Invitación" : "Acceso"} hasta el {fecha}
      </p>
    </div>
  );
}

export function Sidebar({
  certificadosCount,
  diasGracia,
  preferenciaInicial = null,
  acceso = null,
}: {
  certificadosCount: number;
  diasGracia: number | null;
  /** Días que le quedan a un acceso vigente (tarjeta "Tu acceso"). */
  acceso?: AccesoVigente | null;
  /** Preferencia guardada (cookie), leída en el servidor para no parpadear. */
  preferenciaInicial?: PreferenciaSidebar;
}) {
  const [preferencia, setPreferencia] = useState(preferenciaInicial);
  const modo = modoDe(preferencia);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-uva-divider bg-uva-surface transition-[width] duration-150 md:flex",
        { compacto: "w-[76px]", completo: "w-64", auto: "w-[76px] xl:w-64" }[modo],
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          // Mismo esquema de padding que `nav` (px-2.5) para que el botón de
          // colapsar quede centrado exactamente sobre los íconos de abajo —
          // con `px-4` (el de antes) el botón quedaba 6px a la izquierda del
          // centro real de los íconos colapsados.
          {
            compacto: "justify-center px-3",
            completo: "justify-between pr-4 pl-5",
            auto: "justify-center px-3 xl:justify-between xl:pr-4 xl:pl-5",
          }[modo],
        )}
      >
        <Link
          href="/dashboard"
          aria-label="U.V.A., ir al inicio del panel"
          className={cn(
            "min-h-11 items-center text-uva-text no-underline hover:no-underline",
            { compacto: "hidden", completo: "inline-flex", auto: "hidden xl:inline-flex" }[modo],
          )}
        >
          <LogoUva className="h-[27px] w-[83px]" />
        </Link>
        <button
          type="button"
          onClick={() => {
            // En `auto` se invierte lo que se ve en este ancho.
            const compactoAhora =
              modo === "compacto" || (modo === "auto" && !window.matchMedia("(min-width: 1280px)").matches);
            setPreferencia(compactoAhora ? "expandido" : "colapsado");
            guardarSidebarColapsado(!compactoAhora);
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-uva-sm text-uva-text-muted hover:bg-uva-hover hover:text-uva-text"
        >
          {/* Nombre e ícono de lo que hará el botón en este ancho. */}
          <span className={cn("contents", SOLO_COMPACTO[modo])}>
            <span className="sr-only">Expandir menú</span>
            <PanelLeft className="size-[18px]" strokeWidth={1.9} aria-hidden />
          </span>
          <span className={cn("contents", SOLO_COMPLETO[modo])}>
            <span className="sr-only">Colapsar menú</span>
            <PanelLeftClose className="size-[18px]" strokeWidth={1.9} aria-hidden />
          </span>
        </button>
      </div>

      <TooltipProvider delay={150}>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label="Navegación principal">
          {navPrincipal.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              modo={modo}
            />
          ))}

          <p className={cn("mt-[18px] mb-1.5 px-3 text-uva-detalle font-bold text-uva-text-muted", SOLO_COMPLETO[modo])}>
            Tu progreso
          </p>
          <div className={cn("my-3 border-t border-uva-divider", SOLO_COMPACTO[modo])} />

          {navProgreso.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              modo={modo}
              badge={
                item.href === "/dashboard/certificados"
                  ? String(certificadosCount).padStart(2, "0")
                  : undefined
              }
            />
          ))}
        </nav>
      </TooltipProvider>

      {/* Fuera del `nav` que scrollea: la tarjeta de gracia y Soporte deben
          quedarse siempre visibles al fondo del sidebar, no desplazarse con
          la lista de arriba. Cuando hay período de gracia, Soporte se corre
          debajo de esa tarjeta (no encima) — mismo lugar de siempre, solo
          empujado por el módulo que aparece arriba. */}
      {diasGracia !== null && (
        <div className={cn("shrink-0 px-[19px] pt-[19px]", SOLO_COMPLETO[modo])}>
          <GraciaCard diasGracia={diasGracia} />
        </div>
      )}

      {acceso && diasGracia === null && (
        <div className={cn("contents", SOLO_COMPLETO[modo])}>
          <TarjetaAcceso acceso={acceso} />
        </div>
      )}

      <div className="shrink-0 border-t border-uva-divider px-3 py-2">
        <TooltipProvider delay={150}>
          <NavLink
            href="/dashboard/soporte"
            label="Soporte"
            icon={HelpCircle}
            active={isActive("/dashboard/soporte")}
            modo={modo}
          />
        </TooltipProvider>
      </div>
    </aside>
  );
}
