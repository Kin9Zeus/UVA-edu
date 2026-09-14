import { Header } from "@/components/home/Header";
import { Header as DashboardHeader } from "@/components/dashboard/Header";
import { getDashboardChromeData } from "@/lib/dashboard-chrome";
import type { getPerfilActual } from "@/lib/perfil";

/**
 * Header de las páginas públicas que también se navegan estando logueado
 * (curso, catálogo, reproductor): sin sesión muestra el header de marketing
 * con "Acceder"; con sesión, el mismo header que usa el dashboard —
 * incluida la campana de notificaciones, que antes se quedaba siempre vacía
 * acá (nunca se pedían: DashboardHeader por defecto recibe `[]`/`0`) aunque
 * el estudiante sí tuviera notificaciones sin leer. Mismo dato que ya carga
 * `getDashboardChromeData` para el Sidebar/Header del dashboard — se repite
 * la consulta acá en vez de que el caller la pase, para no tener que tocar
 * los 6 page.tsx que usan este componente cada vez que a SiteHeader le haga
 * falta un dato más del chrome.
 */
export async function SiteHeader({
  user,
  perfil,
  ocultarBuscador = false,
}: Awaited<ReturnType<typeof getPerfilActual>> & {
  /** Ver Header (dashboard) — el reproductor de lección lo pasa en true. */
  ocultarBuscador?: boolean;
}) {
  if (!user) return <Header ocultarBuscador={ocultarBuscador} />;

  const { nombre, fotoUrl, esAdmin, diasGracia, notificaciones, notificacionesNoLeidas } =
    await getDashboardChromeData({ user, perfil });

  return (
    <DashboardHeader
      nombre={nombre}
      fotoUrl={fotoUrl}
      esAdmin={esAdmin}
      mostrarLogo
      ocultarBuscador={ocultarBuscador}
      diasGracia={diasGracia}
      notificaciones={notificaciones}
      notificacionesNoLeidas={notificacionesNoLeidas}
    />
  );
}
