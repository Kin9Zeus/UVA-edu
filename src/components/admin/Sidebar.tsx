"use client";

import { useState } from "react";
import { guardarSidebarColapsado, type PreferenciaSidebar } from "@/lib/sidebar-preferencia";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FolderTree,
  Ticket,
  TicketPercent,
  ScrollText,
  Flag,
  CreditCard,
  User,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoUva } from "@/components/home/LogoUva";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Item = { href: string; label: string; icon: LucideIcon };

/**
 * Menú agrupado por tarea, con el mismo aspecto que el del panel del
 * estudiante (dirección visual «Maqueta»). Es una copia de su estilo, no un
 * componente compartido: el panel del estudiante quedó cerrado y no se toca
 * desde aquí.
 */
const secciones: { titulo: string | null; items: Item[] }[] = [
  { titulo: null, items: [{ href: "/admin", label: "Inicio", icon: LayoutDashboard }] },
  {
    titulo: "Contenido",
    items: [
      { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
      { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
    ],
  },
  {
    titulo: "Personas",
    items: [
      // Sin entrada "Instructores": un instructor es una cuenta con rol
      // PROFESOR, así que se gestiona desde Usuarios ("Hacer profesor" +
      // especialidad en la ficha). La sección propia se eliminó con la
      // migración 20260903000000_multi_instructores.
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
      { href: "/admin/codigos", label: "Códigos de invitación", icon: Ticket },
      { href: "/admin/comunidad", label: "Comunidad", icon: Flag },
    ],
  },
  {
    // Cupones va con Planes y no con Códigos a propósito: un cupón descuenta
    // sobre el precio de un plan (siempre hay un cobro detrás), mientras que
    // un código regala acceso sin pasar por caja.
    titulo: "Cobros",
    items: [
      { href: "/admin/planes", label: "Planes", icon: CreditCard },
      { href: "/admin/cupones", label: "Cupones", icon: TicketPercent },
    ],
  },
  { titulo: "Plataforma", items: [{ href: "/admin/bitacora", label: "Bitácora", icon: ScrollText }] },
];

const perfil: Item = { href: "/admin/configuracion", label: "Perfil", icon: User };

/**
 * `compacto` (solo íconos), `completo`, o `auto`: solo íconos por debajo de
 * 1280 px y completo desde ahí, para que en una tableta horizontal el
 * contenido no pierda 256 px. Se resuelve con CSS (`max-xl:`) para que el
 * servidor lo pinte bien sin saber el ancho. Las clases van enteras en cada
 * caso para que Tailwind las vea.
 */
type Modo = "compacto" | "completo" | "auto";
const modoDe = (preferencia: PreferenciaSidebar): Modo =>
  preferencia === "colapsado" ? "compacto" : preferencia === "expandido" ? "completo" : "auto";
const SOLO_COMPLETO: Record<Modo, string> = { compacto: "hidden", completo: "", auto: "max-xl:hidden" };
const SOLO_COMPACTO: Record<Modo, string> = { compacto: "", completo: "hidden", auto: "xl:hidden" };

function NavLink({ href, label, icon: Icon, active, modo }: Item & { active: boolean; modo: Modo }) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Compacto no hay texto visible: el nombre accesible va en el enlace.
      aria-label={modo === "completo" ? undefined : label}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-uva-md px-3 text-uva-cuerpo font-medium text-uva-text-muted no-underline transition-colors hover:bg-uva-hover hover:text-uva-text hover:no-underline",
        active && "bg-uva-surface-2 font-bold text-uva-text shadow-[inset_3px_0_0_var(--uva-btn)]",
        { compacto: "justify-center px-0", completo: "", auto: "max-xl:justify-center max-xl:px-0" }[modo],
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
      <span className={cn("flex-1 truncate", SOLO_COMPLETO[modo])}>{label}</span>
    </Link>
  );

  if (modo === "completo") return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent className={SOLO_COMPACTO[modo]}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ preferenciaInicial = null }: { preferenciaInicial?: PreferenciaSidebar }) {
  const [preferencia, setPreferencia] = useState(preferenciaInicial);
  const modo = modoDe(preferencia);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-uva-divider bg-uva-surface transition-[width] duration-150 motion-reduce:transition-none md:flex",
        { compacto: "w-[76px]", completo: "w-64", auto: "w-[76px] xl:w-64" }[modo],
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          {
            compacto: "justify-center px-3",
            completo: "justify-between pr-4 pl-5",
            auto: "justify-center px-3 xl:justify-between xl:pr-4 xl:pl-5",
          }[modo],
        )}
      >
        <Link
          href="/admin"
          aria-label="U.V.A. Admin, ir al inicio del panel"
          className={cn(
            "min-h-11 items-center gap-2.5 text-uva-text no-underline hover:no-underline",
            { compacto: "hidden", completo: "inline-flex", auto: "hidden xl:inline-flex" }[modo],
          )}
        >
          <LogoUva className="h-[27px] w-[83px]" />
          <EtiquetaAdmin />
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
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label="Navegación del panel admin">
          {secciones.map((seccion) => (
            <div key={seccion.titulo ?? "inicio"} className="flex flex-col gap-0.5">
              {seccion.titulo && (
                <>
                  <p className={cn("mt-[18px] mb-1.5 px-3 text-uva-detalle font-bold text-uva-text-muted", SOLO_COMPLETO[modo])}>
                    {seccion.titulo}
                  </p>
                  <div className={cn("my-3 border-t border-uva-divider", SOLO_COMPACTO[modo])} />
                </>
              )}
              {seccion.items.map((item) => (
                <NavLink key={item.href} {...item} active={isActive(item.href)} modo={modo} />
              ))}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-uva-divider px-3 py-2">
          <NavLink {...perfil} active={isActive(perfil.href)} modo={modo} />
        </div>
      </TooltipProvider>
    </aside>
  );
}

/** "Admin" junto al logo: dice en qué panel estás sin repetir la marca. */
export function EtiquetaAdmin() {
  return (
    <span className="rounded-full bg-uva-accent-soft px-2.5 py-0.5 text-uva-etiqueta font-bold text-uva-accent-text">
      Admin
    </span>
  );
}
