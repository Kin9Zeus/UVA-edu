import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CategoriasTable, type Categoria } from "@/components/admin/categorias/CategoriasTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Categorías",
};

export default async function AdminCategoriasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nombre, descripcion, activo, admin_creador:perfiles(nombre), cursos(count)")
    .order("nombre");

  const categorias: Categoria[] = (data ?? []).map((categoria) => {
    const adminCreador = Array.isArray(categoria.admin_creador)
      ? categoria.admin_creador[0]
      : categoria.admin_creador;
    const cursosCount = Array.isArray(categoria.cursos) ? (categoria.cursos[0]?.count ?? 0) : 0;

    return {
      id: categoria.id,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      activo: categoria.activo,
      creadoPor: adminCreador?.nombre ?? "—",
      numeroCursos: cursosCount,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <CategoriasTable categorias={categorias} />
    </div>
  );
}
