"use client";

import Link from "next/link";
import { Award, ChevronDown, CreditCard, LogOut, NotebookPen, ShieldCheck, User, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectorTemaSistemaMenuItem } from "@/components/tema/SelectorTema";
import { logout } from "@/actions/auth/logout";
import { cn } from "@/lib/utils";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}

const ITEM = "text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text";

/**
 * Avatar con el menú de la cuenta (perfil, suscripción, certificados, notas,
 * tema, cerrar sesión). Lo comparten el encabezado del panel (`Header`) y el
 * de la clase (`LeccionMaqueta`), para que el menú diga lo mismo en los dos.
 */
export function MenuCuenta({
  nombre,
  fotoUrl = null,
  esAdmin = false,
  mostrarNombre = true,
  comunidadSiempre = false,
}: {
  nombre: string;
  fotoUrl?: string | null;
  esAdmin?: boolean;
  /** El primer nombre junto al avatar, desde `sm`. */
  mostrarNombre?: boolean;
  /** En el panel, Comunidad sale en el menú solo en celular (en escritorio ya
   * está en el Sidebar). La clase no tiene Sidebar: va siempre. */
  comunidadSiempre?: boolean;
}) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de usuario"
        className="-my-0.5 flex min-h-11 items-center gap-2 rounded-uva-md py-1 pr-1 pl-1 text-sm text-uva-text outline-hidden hover:bg-uva-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      >
        <Avatar className="size-9 border-[1.5px] border-uva-line-strong bg-uva-surface-2">
          {fotoUrl && <AvatarImage src={fotoUrl} alt="" />}
          <AvatarFallback className="bg-uva-surface-2 text-uva-detalle font-extrabold text-uva-text">
            {iniciales(nombre)}
          </AvatarFallback>
        </Avatar>
        {mostrarNombre && (
          <span className="hidden max-w-[120px] truncate text-uva-cuerpo font-bold sm:inline">{primerNombre}</span>
        )}
        <ChevronDown className="size-4 text-uva-text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLinkItem render={<Link href="/dashboard/perfil" />} className={ITEM}>
          <User className="size-4" />
          Ver mi perfil
        </DropdownMenuLinkItem>
        {/* En el panel, en celular el Sidebar (con su ítem de Comunidad) está
            oculto: BottomTabBar reserva este espacio del menú para
            Comunidad/Perfil/Suscripción, ver el comentario en ese archivo. */}
        <DropdownMenuLinkItem
          render={<Link href="/dashboard/comunidad" />}
          className={cn(ITEM, !comunidadSiempre && "md:hidden")}
        >
          <Users className="size-4" />
          Comunidad
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link href="/dashboard/suscripcion" />} className={ITEM}>
          <CreditCard className="size-4" />
          Mi suscripción
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link href="/dashboard/certificados" />} className={ITEM}>
          <Award className="size-4" />
          Mis certificados
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link href="/dashboard/notas" />} className={ITEM}>
          <NotebookPen className="size-4" />
          Mis notas
        </DropdownMenuLinkItem>
        {esAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLinkItem render={<Link href="/admin" />} className={ITEM}>
              <ShieldCheck className="size-4" />
              Panel de administración
            </DropdownMenuLinkItem>
          </>
        )}
        <SelectorTemaSistemaMenuItem className={ITEM} />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} className={ITEM}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
