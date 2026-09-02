import { createClient } from "@/lib/supabase/server";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { calcularDiasGracia } from "@/lib/gracia";
import type { getPerfilActual } from "@/lib/perfil";

type PerfilActual = Awaited<ReturnType<typeof getPerfilActual>>;

/**
 * Datos que necesita el chrome de navegación del dashboard (Sidebar, Header,
 * BottomTabBar): certificadosCount para el badge, diasGracia para el aviso
 * de período de gracia. Compartido entre (student)/dashboard/layout.tsx y
 * /cursos/[id]/page.tsx (que muestra el mismo chrome para estudiantes
 * logueados, ver ese archivo).
 */
export async function getDashboardChromeData({
  user,
  perfil,
}: {
  user: NonNullable<PerfilActual["user"]>;
  perfil: PerfilActual["perfil"];
}) {
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

  return { nombre, esAdmin, certificadosCount: certificadosCount ?? 0, diasGracia };
}
