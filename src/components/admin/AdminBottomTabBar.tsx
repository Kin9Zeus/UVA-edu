"use client";

import {
  LayoutDashboard,
  BookOpen,
  Users,
  Ticket,
  TicketPercent,
  FolderTree,
  Flag,
  CreditCard,
  ScrollText,
  User,
} from "lucide-react";
import { BarraInferior } from "@/components/dashboard/BarraInferior";

// Los 4 de más uso a diario se quedan fijos en la barra; el resto del menú
// lateral vive detrás de "Más".
const principales = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/codigos", label: "Códigos", icon: Ticket },
];

// Mismo orden y nombres que el menú lateral (Sidebar.tsx).
const secundarios = [
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/comunidad", label: "Comunidad", icon: Flag },
  { href: "/admin/planes", label: "Planes", icon: CreditCard },
  { href: "/admin/cupones", label: "Cupones", icon: TicketPercent },
  { href: "/admin/bitacora", label: "Bitácora", icon: ScrollText },
  { href: "/admin/configuracion", label: "Perfil", icon: User },
];

export function AdminBottomTabBar() {
  return (
    <BarraInferior
      etiqueta="Navegación del panel admin"
      inicio="/admin"
      principales={principales}
      secundarios={secundarios}
      tituloMas="Más opciones del panel admin"
    />
  );
}
