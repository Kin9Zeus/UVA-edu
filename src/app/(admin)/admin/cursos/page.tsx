import type { Metadata } from "next";
import { getCursosListado, getCategoriasActivas } from "@/lib/admin/cursos";
import { CursosTable } from "@/components/admin/cursos/CursosTable";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Cursos",
};

export default async function AdminCursosPage() {
  const [cursos, categorias] = await Promise.all([getCursosListado(), getCategoriasActivas()]);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Cursos" descripcion="Crea, edita y publica los cursos del catálogo." />
      <CursosTable cursos={cursos} categorias={categorias} />
    </div>
  );
}
