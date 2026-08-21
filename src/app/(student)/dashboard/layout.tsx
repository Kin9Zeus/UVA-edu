import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";

const DURACION_GRACIA_DIAS = 5;

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

  let diasGracia: number | null = null;
  if (suscripcion?.estado === "PAST_DUE" && suscripcion.fechaRenovacion) {
    const finGracia = new Date(suscripcion.fechaRenovacion).getTime() + DURACION_GRACIA_DIAS * 86_400_000;
    diasGracia = Math.max(0, Math.ceil((finGracia - Date.now()) / 86_400_000));
  }

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
