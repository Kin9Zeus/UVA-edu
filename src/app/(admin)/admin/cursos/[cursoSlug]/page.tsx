import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCursoDetalle, resolverCursoAdmin } from "@/lib/admin/cursoDetalle";
import { getExamenDeCurso } from "@/lib/admin/examenDetalle";
import { getCategoriasParaEdicion } from "@/lib/admin/cursos";
import { getPerfilesProfesor } from "@/lib/admin/profesores";
import { esUuid } from "@/lib/slug";
import { CursoDetalleView } from "@/components/admin/cursos/CursoDetalleView";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Detalle de curso",
};

/**
 * Ficha del curso en el panel, direccionada por slug
 * (/admin/cursos/render-fotorrealista-con-v-ray), igual que la pública.
 *
 * Sigue aceptando el UUID porque hay enlaces que solo lo conocen —la bitácora
 * guarda `id_entidad_afectada`, no el slug— y porque circulan URLs viejas.
 * En ese caso redirige a la versión con slug en vez de servir la ficha en dos
 * direcciones.
 *
 * `redirect` (307) y no `permanentRedirect` (308): el slug se regenera al
 * cambiar el título (actualizarInfoCurso) y un 308 lo guarda el navegador, que
 * seguiría mandando el UUID a un slug que ya no existe.
 */
export default async function AdminCursoDetallePage({
  params,
}: {
  params: Promise<{ cursoSlug: string }>;
}) {
  const { cursoSlug } = await params;
  const referencia = await resolverCursoAdmin(cursoSlug);
  if (!referencia) notFound();
  if (esUuid(cursoSlug)) redirect(`/admin/cursos/${referencia.slug}`);

  const [curso, categorias, instructores, examen] = await Promise.all([
    getCursoDetalle(referencia.id),
    getCategoriasParaEdicion(),
    getPerfilesProfesor(),
    getExamenDeCurso(referencia.id),
  ]);

  if (!curso) notFound();

  return (
    <CursoDetalleView
      curso={curso}
      categorias={categorias}
      instructores={instructores}
      examen={examen}
    />
  );
}
