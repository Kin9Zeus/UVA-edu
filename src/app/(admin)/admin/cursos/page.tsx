import type { Metadata } from "next";
import { getCursosListado, getCategoriasActivas } from "@/lib/admin/cursos";
import { CursosTable } from "@/components/admin/cursos/CursosTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Cursos",
};

export default async function AdminCursosPage() {
  const [cursos, categorias] = await Promise.all([getCursosListado(), getCategoriasActivas()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl text-uva-text">Cursos</h1>
      <CursosTable cursos={cursos} categorias={categorias} />
    </div>
  );
}
