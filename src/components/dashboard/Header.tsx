"use client";

import Link from "next/link";
import { ChevronDown, LogOut, CreditCard, Award, User, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BuscadorHeaderInput } from "@/components/catalogo/BuscadorHeaderInput";
import { GraciaAlerta } from "@/components/dashboard/GraciaAlerta";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth/logout";

const MOSTRAR_PLANES = false;

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}

export function Header({
  nombre,
  esAdmin = false,
  mostrarLogo = false,
  ocultarAccionesEnMobile = false,
  ocultarBuscador = false,
  diasGracia = null,
}: {
  nombre: string;
  esAdmin?: boolean;
  /** `true`: se muestra siempre (ej. SiteHeader en /catalogo, /cursos, donde
   * no hay Sidebar con su propio logo en ningún ancho). `"solo-mobile"`: solo
   * se muestra por debajo de `md`, para el layout del dashboard, cuyo Sidebar
   * (con su propio logo) se oculta en mobile y reaparece desde `md`. */
  mostrarLogo?: boolean | "solo-mobile";
  /** El dashboard tiene su propia barra de navegación inferior en mobile
   * (BottomTabBar) con acceso directo a Catálogo, así que el buscador y el
   * link "Planes" del header sobran ahí por debajo de `md`. */
  ocultarAccionesEnMobile?: boolean;
  /** El reproductor de lección ya trae su propia barra (volver/temario/
   * siguiente clase): el buscador genérico ahí es ruido, no navegación
   * real — a diferencia del resto de páginas con este header, donde sí
   * hace falta. */
  ocultarBuscador?: boolean;
  /** Si no es null, muestra el ícono de alerta de período de gracia (solo
   * mobile; en desktop ese aviso vive en la tarjeta fija del Sidebar). */
  diasGracia?: number | null;
}) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-uva-divider bg-uva-bg/72 px-6 py-3 backdrop-blur">
      {mostrarLogo && (
        <Link
          href="/dashboard"
          className={cn(
            "shrink-0 font-heading text-lg font-bold tracking-[.1em] text-uva-text no-underline hover:no-underline",
            mostrarLogo === "solo-mobile" && "md:hidden",
          )}
        >
          U.V.A<span className="text-uva-accent">.</span>
        </Link>
      )}

      <div
        className={cn(
          "max-w-[420px] flex-1",
          ocultarAccionesEnMobile && "hidden md:block",
        )}
      >
        {!ocultarBuscador && (
          <BuscadorHeaderInput placeholder="¿Qué quieres aprender hoy?" destino="/dashboard/catalogo" />
        )}
      </div>

      {/* Oculto a pedido: "La opcion de Planes ocultala por el momento". */}
      {MOSTRAR_PLANES && (
        <Link
          href="/dashboard/planes"
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold text-uva-text no-underline hover:bg-uva-hover",
            ocultarAccionesEnMobile && "hidden md:inline-block",
          )}
        >
          Planes
        </Link>
      )}

      <div className="ml-auto flex items-center gap-1">
        <GraciaAlerta diasGracia={diasGracia} />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-uva-md py-1 pr-1 pl-1 text-sm text-uva-text outline-none hover:bg-[#1C1C20]"
          >
            <Avatar className="bg-uva-divider">
              <AvatarFallback className="bg-uva-divider text-uva-text">
                {iniciales(nombre)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate sm:inline">
              {primerNombre}
            </span>
            <ChevronDown className="size-4 text-uva-text-faint" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLinkItem
              render={<Link href="/dashboard/perfil" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <User className="size-4" />
              Ver mi perfil
            </DropdownMenuLinkItem>
            <DropdownMenuLinkItem
              render={<Link href="/dashboard/suscripcion" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <CreditCard className="size-4" />
              Mi suscripción
            </DropdownMenuLinkItem>
            <DropdownMenuLinkItem
              render={<Link href="/dashboard/certificados" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <Award className="size-4" />
              Mis certificados
            </DropdownMenuLinkItem>
            {esAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLinkItem
                  render={<Link href="/admin" />}
                  className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
                >
                  <ShieldCheck className="size-4" />
                  Panel de administración
                </DropdownMenuLinkItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
