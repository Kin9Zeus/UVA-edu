import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { InicioContent } from "@/components/dashboard/InicioContent";

export const metadata: Metadata = {
  title: "U.V.A. — Inicio",
};

export default async function DashboardInicioPage() {
  const { user, perfil } = await getPerfilActual();
  const nombre = perfil?.nombre ?? user?.email?.split("@")[0] ?? "Estudiante";

  return <InicioContent nombre={nombre} />;
}
