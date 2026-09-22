import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { getMisNotas } from "@/lib/notas";
import { MisNotasContent } from "@/components/dashboard/MisNotasContent";

export const metadata: Metadata = { title: "U.V.A. — Mis notas" };

/**
 * Todas las notas privadas del estudiante (docs/notas-leccion.md §6.6).
 * Vive en el dashboard, fuera del muro de pago: con la suscripción vencida
 * el reproductor ya no abre, y esta es la única forma de volver a los
 * apuntes propios.
 */
export default async function MisNotasPage() {
  const { user } = await getPerfilActual();
  const misNotas = await getMisNotas(user!.id);
  return <MisNotasContent {...misNotas} />;
}
