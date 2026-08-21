import type { Metadata } from "next";
import { getCatalogo } from "@/lib/categoria";
import { CatalogoContent } from "@/components/dashboard/CatalogoContent";

export const metadata: Metadata = { title: "U.V.A. — Catálogo" };

export default async function CatalogoPage() {
  const categorias = await getCatalogo();

  return <CatalogoContent categorias={categorias} />;
}
