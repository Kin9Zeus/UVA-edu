import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { calcularDiasGracia } from "@/lib/gracia";
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

  // El middleware (src/lib/supabase/proxy.ts) ya cierra la sesión y saca a
  // los usuarios suspendidos; esta verificación es defensa en profundidad
  // por si el layout se renderiza sin haber pasado por el middleware.
  if (perfil?.estado === "SUSPENDIDO") {
    redirect("/login");
  }

  const supabase = await createClient();
  const [{ count: certificadosCount }, suscripcion] = await Promise.all([
    supabase
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", user.id),
    getSuscripcionActual(user.id),
  ]);

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Estudiante";
  const esAdmin = perfil?.rol === "ADMINISTRADOR";

  const diasGracia =
    suscripcion?.estado === "PAST_DUE" && suscripcion.fechaRenovacion
      ? calcularDiasGracia(suscripcion.fechaRenovacion)
      : null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar certificadosCount={certificadosCount ?? 0} diasGracia={diasGracia} />
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Header nombre={nombre} esAdmin={esAdmin} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
