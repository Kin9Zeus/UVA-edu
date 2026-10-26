import type { Metadata } from "next";
import { getCategorias } from "@/lib/admin/categorias";
import { CategoriasTable } from "@/components/admin/categorias/CategoriasTable";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Categorías",
};

export default async function AdminCategoriasPage() {
  const categorias = await getCategorias();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Categorías" descripcion="Las áreas en que se agrupan los cursos del catálogo." />
      <CategoriasTable categorias={categorias} />
    </div>
  );
}
