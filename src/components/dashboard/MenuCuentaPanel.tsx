"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Award, CreditCard, LogOut, NotebookPen, ShieldCheck, User, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectorTemaMenuItem, SelectorTemaSistemaMenuItem } from "@/components/tema/SelectorTemaMenu";
import { logout } from "@/actions/auth/logout";
import { cn } from "@/lib/utils";
import { CLASE_BOTON_CUENTA, ContenidoBotonCuenta, type PropsMenuCuenta } from "@/components/dashboard/MenuCuenta";

const ITEM = "text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text";

/**
 * El menú desplegable de la cuenta. Lo carga MenuCuenta al primer indicio de
 * uso (ver ahí); `abiertoAlInicio` lo abre si ya se tocó el botón, y
 * `enfocarAlMontar` le pasa el foco al botón nuevo si el anterior lo tenía.
 */
export function MenuCuentaPanel({
  nombre,
  fotoUrl = null,
  esAdmin = false,
  mostrarNombre = true,
  comunidadSiempre = false,
  temaEnMenu = false,
  abiertoAlInicio,
  enfocarAlMontar,
}: PropsMenuCuenta & { abiertoAlInicio: boolean; enfocarAlMontar: boolean }) {
  const botonRef = useRef<HTMLButtonElement>(null);
  // Solo al montar: después el foco lo maneja el menú.
  const enfocar = useRef(enfocarAlMontar);
  useEffect(() => {
    if (enfocar.current) botonRef.current?.focus();
  }, []);
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <DropdownMenu defaultOpen={abiertoAlInicio}>
      <DropdownMenuTrigger ref={botonRef} aria-label={`Menú de ${primerNombre}`} className={CLASE_BOTON_CUENTA}>
        <ContenidoBotonCuenta nombre={nombre} fotoUrl={fotoUrl} mostrarNombre={mostrarNombre} />
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
        {temaEnMenu && <SelectorTemaMenuItem className={cn(ITEM, "lg:hidden")} />}
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
