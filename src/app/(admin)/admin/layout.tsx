import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";
import { AdminToastProvider } from "@/components/admin/Toast";

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
  // administradores; esta verificación es defensa en profundidad por si el
  // layout se renderiza sin haber pasado por el middleware (ej. tests).
  if (perfil?.rol !== "ADMINISTRADOR") {
    redirect("/");
  }

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Administrador";

  return (
    <AdminToastProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header nombre={nombre} />
          <main className="flex-1 px-[clamp(20px,3vw,36px)] py-8">
            <div className="mx-auto max-w-[1360px]">{children}</div>
          </main>
        </div>
      </div>
    </AdminToastProvider>
  );
}
