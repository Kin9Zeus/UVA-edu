import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, perfil } = await getPerfilActual();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const supabase = await createClient();
  const { count: certificadosCount } = await supabase
    .from("certificados")
    .select("id", { count: "exact", head: true })
    .eq("id_usuario", user.id);

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Estudiante";
  const esAdmin = perfil?.rol === "ADMINISTRADOR";

  return (
    <div className="flex min-h-screen">
      <Sidebar certificadosCount={certificadosCount ?? 0} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header nombre={nombre} esAdmin={esAdmin} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
