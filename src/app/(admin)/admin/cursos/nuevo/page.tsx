import type { Metadata } from "next";
import { getCategoriasActivas } from "@/lib/admin/cursos";
import { getInstructoresParaSelector } from "@/lib/admin/instructores";
import { CrearCursoForm } from "@/components/admin/cursos/CrearCursoForm";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Crear curso",
};

export default async function AdminCrearCursoPage() {
  const [categorias, instructores] = await Promise.all([
    getCategoriasActivas(),
    getInstructoresParaSelector(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl text-uva-text">Crear curso</h1>
      <CrearCursoForm categorias={categorias} instructores={instructores} />
    </div>
  );
}
