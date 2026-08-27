import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { getInicioData } from "@/lib/dashboard";
import { InicioContent } from "@/components/dashboard/InicioContent";

export const metadata: Metadata = {
  title: "U.V.A. — Inicio",
};

export default async function DashboardInicioPage() {
  const { user, perfil } = await getPerfilActual();
  const nombre = perfil?.nombre ?? user?.email?.split("@")[0] ?? "Estudiante";
  const { sigueAprendiendo, categorias } = await getInicioData();

  return (
    <InicioContent
      nombre={nombre}
      sigueAprendiendo={sigueAprendiendo}
      categorias={categorias}
    />
  );
}
