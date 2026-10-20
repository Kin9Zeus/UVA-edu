import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { getDashboardChromeData } from "@/lib/dashboard-chrome";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { BottomTabBar } from "@/components/dashboard/BottomTabBar";
import { leerSidebarColapsado } from "@/lib/sidebar-preferencia-servidor";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, perfil } = await getPerfilActual();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  // El middleware (src/lib/supabase/proxy.ts) ya cierra la sesión y saca a
  // los usuarios suspendidos; esta verificación es defensa en profundidad
  // por si el layout se renderiza sin haber pasado por el middleware.
  if (perfil?.estado === "SUSPENDIDO") {
    redirect("/login");
  }

  const { nombre, fotoUrl, esAdmin, certificadosCount, diasGracia, acceso, notificaciones, notificacionesNoLeidas } =
    await getDashboardChromeData({ user, perfil });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        certificadosCount={certificadosCount}
        diasGracia={diasGracia}
        acceso={acceso}
        colapsadoInicial={await leerSidebarColapsado()}
      />
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          nombre={nombre}
          fotoUrl={fotoUrl}
          esAdmin={esAdmin}
          mostrarLogo="solo-mobile"
          ocultarAccionesEnMobile
          diasGracia={diasGracia}
          notificaciones={notificaciones}
          notificacionesNoLeidas={notificacionesNoLeidas}
        />
        {/* `relative`: el contenedor que desplaza también es la referencia de
            lo que va en posición absoluta. Sin esto, un `sr-only` (absoluto)
            hacia el final de una página se salía del `overflow` y estiraba
            el documento: dos barras de desplazamiento (pasaba en Soporte). */}
        <main id="contenido" tabIndex={-1} className="relative flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
        <BottomTabBar />
      </div>
    </div>
  );
}
