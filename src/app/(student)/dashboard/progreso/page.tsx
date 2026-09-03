import type { Metadata } from "next";
import { getProgresoData } from "@/lib/progreso";
import { ProgresoContent } from "@/components/dashboard/ProgresoContent";

export const metadata: Metadata = { title: "U.V.A. — Progreso" };

export default async function ProgresoPage() {
  const data = await getProgresoData();

  return <ProgresoContent data={data} />;
}
