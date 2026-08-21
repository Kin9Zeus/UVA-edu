"use client";

import Link from "next/link";
import { Search, ChevronDown, LogOut, CreditCard, Award, User, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth/logout";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}

export function Header({ nombre, esAdmin = false }: { nombre: string; esAdmin?: boolean }) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-uva-divider bg-uva-bg/72 px-6 py-3 backdrop-blur">
      <div className="relative max-w-[420px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-uva-text-faint" />
        <input
          type="search"
          placeholder="¿Qué quieres aprender hoy?"
          className="h-[38px] w-full rounded-uva-md border border-uva-divider bg-uva-surface pr-3.5 pl-9 text-sm text-uva-text outline-none placeholder:text-uva-text-faint focus-visible:border-uva-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-uva-accent"
        />
      </div>

      <Link
        href="/dashboard/planes"
        className="ml-auto shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold text-uva-text no-underline hover:bg-uva-hover"
      >
        Planes
      </Link>

      <div className="flex items-center">
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
