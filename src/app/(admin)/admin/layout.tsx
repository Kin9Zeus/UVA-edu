import { exigirAdministradorEnPagina } from "@/lib/admin/guardiaPagina";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminBottomTabBar } from "@/components/admin/AdminBottomTabBar";
import { Header } from "@/components/admin/Header";
import { AdminToastProvider } from "@/components/admin/Toast";
import { AdminSearchProvider } from "@/components/admin/SearchContext";
import { leerPreferenciaSidebar } from "@/lib/sidebar-preferencia-servidor";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La puerta del panel (rol, cuenta activa y segundo factor). Cada página la
  // llama también: un layout no se vuelve a ejecutar al navegar y no impide
  // que la página corra (ver src/lib/admin/guardiaPagina.ts). Quitarla de
  // aquí no abre nada mientras las páginas la tengan, pero el layout también
  // pinta datos del administrador (nombre, foto) y debe tenerla.
  const { user, perfil } = await exigirAdministradorEnPagina("/admin");

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Administrador";
  const fotoUrl = perfil?.foto_url ?? null;

  return (
    <AdminToastProvider>
      <AdminSearchProvider>
        <div className="flex min-h-dvh">
          <Sidebar preferenciaInicial={await leerPreferenciaSidebar()} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header nombre={nombre} fotoUrl={fotoUrl} />
            {/* Mismo ancho y márgenes que el panel del estudiante. Abajo, en
                celular, el espacio de la barra de navegación flotante. */}
            <main id="contenido" tabIndex={-1} className="flex-1 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-0">
              <div className="mx-auto w-full max-w-uva px-uva-margen py-7 lg:py-9">{children}</div>
            </main>
            <AdminBottomTabBar />
          </div>
        </div>
      </AdminSearchProvider>
    </AdminToastProvider>
  );
}
