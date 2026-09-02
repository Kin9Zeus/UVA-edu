import type { Metadata } from "next";
import { getCategoriasActivas } from "@/lib/admin/cursos";
import { getPerfilesProfesor } from "@/lib/admin/profesores";
import { CrearCursoForm } from "@/components/admin/cursos/CrearCursoForm";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Crear curso",
};

export default async function AdminCrearCursoPage() {
  const [categorias, instructores] = await Promise.all([
    getCategoriasActivas(),
    getPerfilesProfesor(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <CrearCursoForm categorias={categorias} instructores={instructores} />
    </div>
  );
}
