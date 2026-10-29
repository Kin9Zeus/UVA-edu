import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCategoriasActivas } from "@/lib/admin/cursos";
import { getPerfilesProfesor } from "@/lib/admin/profesores";
import { CrearCursoForm } from "@/components/admin/cursos/CrearCursoForm";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Nuevo curso",
};

export default async function AdminCrearCursoPage() {
  const [categorias, instructores] = await Promise.all([
    getCategoriasActivas(),
    getPerfilesProfesor(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/cursos"
        className="-mb-3 flex min-h-11 w-fit items-center gap-1.5 text-uva-detalle text-uva-muted-2 hover:text-uva-text pointer-fine:min-h-0"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a cursos
      </Link>
      <EncabezadoPagina titulo="Nuevo curso" descripcion="Los datos básicos. Los módulos y las clases se agregan después, en Contenido." />
      <CrearCursoForm categorias={categorias} instructores={instructores} />
    </div>
  );
}
