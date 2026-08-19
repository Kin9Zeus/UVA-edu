"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
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

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "A";
}

export function Header({ nombre }: { nombre: string }) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-uva-divider bg-uva-bg/72 px-6 py-3 backdrop-blur">
      <div className="ml-auto flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-uva-md py-1 pr-1 pl-1 text-sm text-uva-text outline-none hover:bg-[#1C1C20]">
            <Avatar className="bg-uva-divider">
              <AvatarFallback className="bg-uva-divider text-uva-text">
                {iniciales(nombre)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[140px] truncate sm:inline">{primerNombre}</span>
            <ChevronDown className="size-4 text-uva-text-faint" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLinkItem
              render={<Link href="/admin/configuracion" />}
              className="text-uva-text no-underline hover:bg-transparent hover:text-uva-text hover:no-underline focus:bg-transparent focus:text-uva-text"
            >
              <User className="size-4" />
              Ver perfil
            </DropdownMenuLinkItem>
            <DropdownMenuLinkItem
              render={<Link href="/admin/configuracion" />}
              className="text-uva-text no-underline hover:bg-transparent hover:text-uva-text hover:no-underline focus:bg-transparent focus:text-uva-text"
            >
              <Settings className="size-4" />
              Configuración
            </DropdownMenuLinkItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-uva-text no-underline hover:bg-transparent hover:text-uva-text hover:no-underline focus:bg-transparent focus:text-uva-text"
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
