import type { Metadata } from "next";
import { getCategorias } from "@/lib/admin/categorias";
import { CategoriasTable } from "@/components/admin/categorias/CategoriasTable";
import { ResumenCategorias } from "@/components/admin/categorias/ResumenCategorias";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Categorías",
};

export default async function AdminCategoriasPage() {
  const resumen = await getCategorias();

  return (
    <CategoriasTable
      categorias={resumen.categorias}
      encabezado={
        <EncabezadoPagina
          titulo="Categorías"
          descripcion="Las áreas del catálogo: cuáles se ven, cuántos cursos tienen y dónde estudia la gente."
        />
      }
      resumen={<ResumenCategorias resumen={resumen} />}
    />
  );
}
