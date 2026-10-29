"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Search, User } from "lucide-react";
import { LogoUva } from "@/components/home/LogoUva";
import { EtiquetaAdmin } from "@/components/admin/Sidebar";
import { CLASE_CAMPO_BUSCADOR, CLASE_ICONO_BUSCADOR } from "@/components/catalogo/campoBuscador";
import { useAdminSearch } from "@/components/admin/SearchContext";
import { BuscadorMovilDialog } from "@/components/admin/BuscadorMovilDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth/logout";
import { SelectorTemaBoton } from "@/components/tema/SelectorTema";
import { SelectorTemaSistemaMenuItem } from "@/components/tema/SelectorTemaMenu";
import { cn } from "@/lib/utils";

/** Solo los dos listados largos tienen buscador: filtra esa lista, no busca en todo el panel. */
function buscadorDeSeccion(pathname: string) {
  if (pathname === "/admin/cursos") return "Buscar cursos...";
  if (pathname === "/admin/usuarios") return "Buscar por nombre o correo...";
  return null;
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "A";
}

export function Header({ nombre, fotoUrl = null }: { nombre: string; fotoUrl?: string | null }) {
  const pathname = usePathname();
  const { query, setQuery } = useAdminSearch();
  const placeholder = buscadorDeSeccion(pathname);

  return (
    // Mismo encabezado que el panel del estudiante: 64 px, fondo translúcido
    // y el logo solo en celular (en escritorio ya está en el menú). El
    // título de cada pantalla va en la página (EncabezadoPagina), no aquí.
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-1 border-b border-uva-divider bg-uva-bg/90 pr-2.5 pl-4 backdrop-blur md:gap-4 md:px-8">
      <Link
        href="/admin"
        aria-label="U.V.A. Admin, ir al inicio del panel"
        className="mr-auto inline-flex min-h-11 shrink-0 items-center gap-2 text-uva-text no-underline hover:no-underline md:hidden"
      >
        <LogoUva className="h-[25px] w-[77px]" />
        <EtiquetaAdmin />
      </Link>

      {placeholder && (
        <div className="relative hidden max-w-[420px] flex-1 md:block">
          <Search className={cn(CLASE_ICONO_BUSCADOR, "size-4")} strokeWidth={2.2} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className={CLASE_CAMPO_BUSCADOR}
          />
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {placeholder && <BuscadorMovilDialog placeholder={placeholder} className="md:hidden" />}
        {/* Visible siempre, no escondido en el menú de usuario. -my-0.5: área
            táctil de 44px sin crecer el header (lo fija el avatar). */}
        <SelectorTemaBoton className="-my-0.5 text-uva-text hover:bg-uva-hover hover:text-uva-text" />
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Menú de ${nombre.trim().split(/\s+/)[0] ?? nombre}`} className="flex min-h-11 items-center gap-2 rounded-uva-md py-1 pr-1 pl-1 text-uva-detalle text-uva-text outline-hidden hover:bg-uva-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent">
            <Avatar className="size-10 bg-uva-surface-2 after:hidden">
              {fotoUrl && <AvatarImage src={fotoUrl} alt="" />}
              <AvatarFallback className="bg-uva-surface-2 font-heading text-uva-detalle font-bold text-uva-text">
                {iniciales(nombre)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[180px] truncate text-uva-detalle font-semibold sm:inline">
              {nombre}
            </span>
            <ChevronDown className="hidden size-3 text-uva-muted-2 sm:block" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLinkItem
              render={<Link href="/dashboard" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <LayoutDashboard className="size-4" />
              Ir a mi panel de estudiante
            </DropdownMenuLinkItem>
            <DropdownMenuSeparator />
            <DropdownMenuLinkItem
              render={<Link href="/admin/configuracion" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <User className="size-4" />
              Ver perfil
            </DropdownMenuLinkItem>
            <SelectorTemaSistemaMenuItem className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text" />
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
