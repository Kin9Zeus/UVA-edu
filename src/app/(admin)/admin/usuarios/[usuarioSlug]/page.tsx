import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioDetalle, resolverUsuarioAdmin } from "@/lib/admin/usuarioDetalle";
import { esUuid } from "@/lib/slug";
import { UsuarioDetalleView } from "@/components/admin/usuarios/UsuarioDetalleView";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Detalle de usuario",
};

/**
 * Ficha del usuario, direccionada por slug (/admin/usuarios/andres-escobar).
 *
 * Sigue aceptando el UUID —la bitácora guarda ids, y circulan enlaces
 * viejos— pero redirige a la versión con slug para que la barra del
 * navegador nunca muestre el id. 307 y no 308 por lo mismo que en /cursos/[cursoSlug]/page.tsx: el slug puede cambiar.
 */
export default async function AdminUsuarioDetallePage({
  params,
}: {
  params: Promise<{ usuarioSlug: string }>;
}) {
  const { usuarioSlug } = await params;
  const referencia = await resolverUsuarioAdmin(usuarioSlug);
  if (!referencia) notFound();
  if (esUuid(usuarioSlug)) redirect(`/admin/usuarios/${referencia.slug}`);

  const usuario = await getUsuarioDetalle(referencia.id);
  if (!usuario) notFound();

  const supabase = await createClient();
  const [{ data: planes }, { data: cursos }] = await Promise.all([
    supabase.from("planes").select("id, nombre, precio_centavos, moneda").eq("activo", true).order("orden"),
    supabase.from("cursos").select("id, titulo").order("titulo"),
  ]);

  const cursosYaAsignados = new Set(usuario.cursos.map((curso) => curso.cursoId));
  const cursosDisponibles = (cursos ?? []).filter((curso) => !cursosYaAsignados.has(curso.id));

  return (
    <UsuarioDetalleView
      usuario={usuario}
      planes={planes ?? []}
      cursosDisponibles={cursosDisponibles}
    />
  );
}
