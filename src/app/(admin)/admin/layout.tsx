import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminBottomTabBar } from "@/components/admin/AdminBottomTabBar";
import { Header } from "@/components/admin/Header";
import { AdminToastProvider } from "@/components/admin/Toast";
import { AdminSearchProvider } from "@/components/admin/SearchContext";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, perfil } = await getPerfilActual();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  // Cuenta suspendida: esto SÍ es defensa en profundidad. El middleware
  // (src/lib/supabase/proxy.ts) ya cierra la sesión de una cuenta suspendida
  // en cada request a ruta protegida; esta línea cubre el caso de que el
  // layout se renderice sin haber pasado por él.
  if (perfil?.estado === "SUSPENDIDO") {
    redirect("/login");
  }

  // ATENCIÓN: este redirect es la ÚNICA puerta de rol del panel. No es
  // redundante y no se puede quitar (P2-1, AUDIT-2026-09-08).
  //
  // El comentario anterior decía que el middleware "ya bloquea /admin para
  // no administradores" y que esto era defensa en profundidad. Dejó de ser
  // cierto al cerrar P2-8 de AUDIT-2026-09-04: proxy.ts quitó a propósito
  // su consulta de rol —para no pagarla dos veces por request— delegando
  // justamente en este layout, y su propio comentario lo explica. Los dos
  // archivos se señalaban mutuamente como la capa redundante, así que quien
  // leyera cualquiera de los dos podía quitar el otro sin ver el hueco.
  //
  // Si algún día hay que quitarlo de aquí, primero hay que devolver el
  // chequeo de rol al middleware. Lo que protege es la LECTURA del panel
  // (bitácora, listado de usuarios, métricas): las mutaciones tienen
  // además requireAdmin() en las 51 Server Actions y RLS
  // (private.es_administrador()) detrás, pero ninguna de esas dos capas
  // impide renderizar la pantalla.
  //
  // La regresión está cubierta por src/lib/admin/muro-admin.test.ts.
  if (perfil?.rol !== "ADMINISTRADOR") {
    redirect("/acceso-denegado");
  }

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Administrador";
  const fotoUrl = perfil?.foto_url ?? null;

  return (
    <AdminToastProvider>
      <AdminSearchProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header nombre={nombre} fotoUrl={fotoUrl} />
            {/* `main` del mockup: padding 28px / clamp / 60px y ancho maximo
                de 1360px alineado a la izquierda, no centrado. */}
            <main className="flex-1 px-[clamp(20px,3vw,36px)] pt-7 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-15">
              <div className="max-w-[1360px]">{children}</div>
            </main>
            <AdminBottomTabBar />
          </div>
        </div>
      </AdminSearchProvider>
    </AdminToastProvider>
  );
}
