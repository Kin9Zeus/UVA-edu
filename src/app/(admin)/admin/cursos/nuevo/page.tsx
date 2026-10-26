import type { Metadata } from "next";
import { getCategoriasActivas } from "@/lib/admin/cursos";
import { getPerfilesProfesor } from "@/lib/admin/profesores";
import { CrearCursoForm } from "@/components/admin/cursos/CrearCursoForm";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

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
      <EncabezadoPagina titulo="Crear curso" descripcion="Los datos básicos del curso. Los módulos y las lecciones se agregan después, en el editor." />
      <CrearCursoForm categorias={categorias} instructores={instructores} />
    </div>
  );
}
