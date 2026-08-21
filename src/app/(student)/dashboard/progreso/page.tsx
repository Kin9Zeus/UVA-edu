import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { getProgresoData } from "@/lib/progreso";
import { ProgresoContent } from "@/components/dashboard/ProgresoContent";

export const metadata: Metadata = { title: "U.V.A. — Progreso" };

export default async function ProgresoPage() {
  const { user } = await getPerfilActual();
  const data = await getProgresoData(user!.id);

  return <ProgresoContent data={data} />;
}
