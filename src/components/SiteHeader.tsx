import { Header } from "@/components/home/Header";
import { Header as DashboardHeader } from "@/components/dashboard/Header";
import type { getPerfilActual } from "@/lib/perfil";

/**
 * Header de las páginas públicas que también se navegan estando logueado
 * (curso, catálogo): sin sesión muestra el header de marketing con
 * "Acceder"; con sesión, el mismo header que usa el dashboard.
 */
export function SiteHeader({
  user,
  perfil,
}: Awaited<ReturnType<typeof getPerfilActual>>) {
  if (!user) return <Header />;

  return (
    <DashboardHeader
      nombre={perfil?.nombre ?? user.email?.split("@")[0] ?? "Estudiante"}
      esAdmin={perfil?.rol === "ADMINISTRADOR"}
      mostrarLogo
    />
  );
}
