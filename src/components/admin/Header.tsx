"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Search, Settings, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAdminSearch } from "@/components/admin/SearchContext";
import { BuscadorMovilDialog } from "@/components/admin/BuscadorMovilDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth/logout";

/**
 * Mapa `titles` del mockup: el titulo de cada pantalla vive en el header, no
 * en el cuerpo de la pagina.
 */
function tituloDeSeccion(pathname: string) {
  if (pathname === "/admin") return "Dashboard";
  if (pathname === "/admin/cursos") return "Cursos";
  if (pathname === "/admin/cursos/nuevo") return "Crear curso";
  if (pathname.startsWith("/admin/cursos/")) return "Editar curso";
  if (pathname === "/admin/usuarios") return "Usuarios";
  if (pathname.startsWith("/admin/usuarios/")) return "Detalle de usuario";
  if (pathname.startsWith("/admin/categorias")) return "Categorías";
  if (pathname.startsWith("/admin/codigos")) return "Códigos de invitación";
  if (pathname.startsWith("/admin/bitacora")) return "Bitácora";
  if (pathname.startsWith("/admin/configuracion")) return "Configuración";
  return "Panel";
}

/** `showSearch` del mockup: solo los dos listados largos lo muestran. */
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

export function Header({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const { query, setQuery } = useAdminSearch();
  const placeholder = buscadorDeSeccion(pathname);

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-uva-divider bg-[color-mix(in_srgb,var(--uva-bg)_82%,transparent)] px-[clamp(20px,3vw,36px)] py-4 backdrop-blur-[12px]">
      {/* El Sidebar (con su propio logo) se oculta por debajo de `md`; sin
          esto el mobile se queda sin ninguna marca U.V.A visible. */}
      <Link
        href="/admin"
        className="shrink-0 font-heading text-lg font-bold tracking-[.1em] text-uva-text no-underline hover:no-underline md:hidden"
      >
        U.V.A<span className="text-uva-accent">.</span>
      </Link>

      <h2 className="font-heading text-[19px] font-bold tracking-[-0.02em] text-uva-text">
        {tituloDeSeccion(pathname)}
      </h2>

      {placeholder && (
        <div className="relative hidden max-w-[320px] flex-1 md:block">
          <Search
            className="pointer-events-none absolute top-[11px] left-[13px] size-[15px] text-uva-muted-2"
            strokeWidth={2.4}
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-9"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-3.5">
        {placeholder && <BuscadorMovilDialog placeholder={placeholder} className="md:hidden" />}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-uva-md py-1 pr-1 pl-1 text-sm text-uva-text outline-none hover:bg-[#1C1C20]">
            {/* `.avatar` del mockup: 34px, sin anillo, mono-espaciado no: Plus Jakarta 700/12 */}
            <Avatar className="size-[34px] bg-uva-divider after:hidden">
              <AvatarFallback className="bg-uva-divider font-heading text-[12px] font-bold text-uva-muted">
                {iniciales(nombre)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[180px] truncate text-[13px] font-semibold sm:inline">
              {nombre}
            </span>
            <ChevronDown className="size-3 text-uva-muted-2" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLinkItem
              render={<Link href="/dashboard" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <LayoutDashboard className="size-4" />
              Volver al dashboard
            </DropdownMenuLinkItem>
            <DropdownMenuSeparator />
            <DropdownMenuLinkItem
              render={<Link href="/admin/configuracion" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <User className="size-4" />
              Ver perfil
            </DropdownMenuLinkItem>
            <DropdownMenuLinkItem
              render={<Link href="/admin/configuracion" />}
              className="text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text"
            >
              <Settings className="size-4" />
              Configuración
            </DropdownMenuLinkItem>
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
