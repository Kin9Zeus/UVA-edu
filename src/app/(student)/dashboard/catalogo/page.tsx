import type { Metadata } from "next";
import { getCatalogo } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";

export const metadata: Metadata = {
  title: "U.V.A. — Catálogo",
};

export default async function DashboardCatalogoPage() {
  const categorias = await getCatalogo();

  return (
    <CatalogoContent categorias={categorias} basePath="/dashboard/catalogo" volverHref="/dashboard" />
  );
}
