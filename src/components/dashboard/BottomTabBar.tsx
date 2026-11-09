"use client";

import { Home, Compass, BookOpen, Award, Users, NotebookPen, User, CreditCard, HelpCircle } from "lucide-react";
import { BarraInferior } from "@/components/dashboard/BarraInferior";

// Fijos: lo del recorrido diario, con Certificados a la vista (USA-01). El
// resto, en el mismo orden y nombres que el Sidebar de escritorio.
const principales = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/dashboard/catalogo", label: "Catálogo", icon: Compass },
  { href: "/dashboard/progreso", label: "Mis cursos", icon: BookOpen },
  { href: "/dashboard/certificados", label: "Certificados", icon: Award },
];

const secundarios = [
  { href: "/dashboard/comunidad", label: "Comunidad", icon: Users },
  { href: "/dashboard/notas", label: "Mis notas", icon: NotebookPen },
  { href: "/dashboard/perfil", label: "Perfil", icon: User },
  { href: "/dashboard/suscripcion", label: "Suscripción", icon: CreditCard },
  { href: "/dashboard/soporte", label: "Soporte", icon: HelpCircle },
];

export function BottomTabBar() {
  return (
    <BarraInferior
      etiqueta="Navegación principal"
      inicio="/dashboard"
      principales={principales}
      secundarios={secundarios}
      tituloMas="Más secciones de tu cuenta"
    />
  );
}
