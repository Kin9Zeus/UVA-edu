import type { Metadata } from "next";
import { getProgresoData } from "@/lib/progreso";
import { ProgresoContent } from "@/components/dashboard/ProgresoContent";
import { hoyEnBogota } from "@/lib/racha";

export const metadata: Metadata = { title: "U.V.A. — Mis cursos" };

export default async function ProgresoPage() {
  const data = await getProgresoData();

  // "Hoy" se fija en el servidor: el componente es de cliente y calcular la
  // fecha allá podría no coincidir con el HTML del servidor al hidratar.
  return <ProgresoContent data={data} hoy={hoyEnBogota()} />;
}
