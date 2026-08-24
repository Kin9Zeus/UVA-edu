import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { Sidebar } from "@/components/admin/Sidebar";
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

  // El middleware (src/lib/supabase/proxy.ts) ya bloquea /admin para no
  // administradores y cierra la sesión de cuentas suspendidas; estas
  // verificaciones son defensa en profundidad por si el layout se
  // renderiza sin haber pasado por el middleware (ej. tests).
  if (perfil?.estado === "SUSPENDIDO") {
    redirect("/login");
  }

  if (perfil?.rol !== "ADMINISTRADOR") {
    redirect("/acceso-denegado");
  }

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Administrador";

  return (
    <AdminToastProvider>
      <AdminSearchProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header nombre={nombre} />
            {/* `main` del mockup: padding 28px / clamp / 60px y ancho maximo
                de 1360px alineado a la izquierda, no centrado. */}
            <main className="flex-1 px-[clamp(20px,3vw,36px)] pt-7 pb-15">
              <div className="max-w-[1360px]">{children}</div>
            </main>
          </div>
        </div>
      </AdminSearchProvider>
    </AdminToastProvider>
  );
}
