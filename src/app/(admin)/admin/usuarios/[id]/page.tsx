import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioDetalle } from "@/lib/admin/usuarioDetalle";
import { UsuarioDetalleView } from "@/components/admin/usuarios/UsuarioDetalleView";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Detalle de usuario",
};

export default async function AdminUsuarioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await getUsuarioDetalle(id);
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
