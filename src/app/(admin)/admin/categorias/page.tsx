import type { Metadata } from "next";
import { getCategorias } from "@/lib/admin/categorias";
import { CategoriasTable } from "@/components/admin/categorias/CategoriasTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Categorías",
};

export default async function AdminCategoriasPage() {
  const categorias = await getCategorias();

  return (
    <div className="flex flex-col gap-6">
      <CategoriasTable categorias={categorias} />
    </div>
  );
}
