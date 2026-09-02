import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCursoDetalle } from "@/lib/admin/cursoDetalle";
import { getCategoriasActivas } from "@/lib/admin/cursos";
import { getPerfilesProfesor } from "@/lib/admin/profesores";
import { CursoDetalleView } from "@/components/admin/cursos/CursoDetalleView";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Detalle de curso",
};

export default async function AdminCursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [curso, categorias, instructores] = await Promise.all([
    getCursoDetalle(id),
    getCategoriasActivas(),
    getPerfilesProfesor(),
  ]);

  if (!curso) notFound();

  return <CursoDetalleView curso={curso} categorias={categorias} instructores={instructores} />;
}
