import type { Metadata } from "next";
import { getCursosListado, getCategoriasActivas } from "@/lib/admin/cursos";
import { CursosTable } from "@/components/admin/cursos/CursosTable";
import { ResumenCursos } from "@/components/admin/cursos/ResumenCursos";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Cursos",
};

export default async function AdminCursosPage() {
  const [resumen, categorias] = await Promise.all([getCursosListado(), getCategoriasActivas()]);

  return (
    <CursosTable
      cursos={resumen.cursos}
      categorias={categorias}
      encabezado={
        <EncabezadoPagina
          titulo="Cursos"
          descripcion="Los cursos del catálogo: cuáles se ven, cuánto avanza la gente y dónde se atasca."
        />
      }
      resumen={<ResumenCursos resumen={resumen} />}
    />
  );
}
