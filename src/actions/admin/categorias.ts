"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";

export type AdminActionResult = { error?: string; success?: boolean };

export async function crearCategoria(input: {
  nombre: string;
  descripcion: string;
}): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const nombre = input.nombre.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  const { data, error } = await admin.supabase
    .from("categorias")
    .insert({
      nombre,
      descripcion: input.descripcion.trim() || null,
      id_admin_creador: admin.adminId,
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear la categoría." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Creó la categoría",
    entidadAfectada: "categorias",
    idEntidadAfectada: data.id,
    detalles: nombre,
  });

  revalidatePath("/admin/categorias");
  return { success: true };
}

export async function actualizarCategoria(
  id: string,
  input: { nombre: string; descripcion: string },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const nombre = input.nombre.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  const { error } = await admin.supabase
    .from("categorias")
    .update({ nombre, descripcion: input.descripcion.trim() || null })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar la categoría." };

  revalidatePath("/admin/categorias");
  return { success: true };
}

export async function toggleActivaCategoria(id: string, activo: boolean): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("categorias").update({ activo }).eq("id", id);
  if (error) return { error: "No pudimos actualizar la categoría." };

  revalidatePath("/admin/categorias");
  return { success: true };
}

export async function eliminarCategoria(id: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("categorias").delete().eq("id", id);
  if (error) {
    return {
      error:
        "No pudimos eliminar la categoría. Verifica que no tenga cursos asociados.",
    };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Eliminó una categoría",
    entidadAfectada: "categorias",
    idEntidadAfectada: id,
  });

  revalidatePath("/admin/categorias");
  return { success: true };
}
