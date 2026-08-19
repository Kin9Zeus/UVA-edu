"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";

export type AdminActionResult = { error?: string; success?: boolean };

/** Código de Postgres para violación de restricción única (instructores.nombre). */
const NOMBRE_DUPLICADO = "23505";

export async function crearInstructor(input: {
  nombre: string;
  especialidad: string;
}): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const nombre = input.nombre.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  const { data, error } = await admin.supabase
    .from("instructores")
    .insert({
      nombre,
      especialidad: input.especialidad.trim() || null,
      id_admin_creador: admin.adminId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === NOMBRE_DUPLICADO) {
      return { error: `Ya existe un instructor llamado "${nombre}".` };
    }
    return { error: "No pudimos crear el instructor." };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Creó el instructor",
    entidadAfectada: "instructores",
    idEntidadAfectada: data.id,
    detalles: nombre,
  });

  revalidatePath("/admin/instructores");
  revalidatePath("/admin/cursos");
  return { success: true, id: data.id };
}

export async function actualizarInstructor(
  id: string,
  input: { nombre: string; especialidad: string },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const nombre = input.nombre.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  const { error } = await admin.supabase
    .from("instructores")
    .update({ nombre, especialidad: input.especialidad.trim() || null })
    .eq("id", id);

  if (error) {
    if (error.code === NOMBRE_DUPLICADO) {
      return { error: `Ya existe un instructor llamado "${nombre}".` };
    }
    return { error: "No pudimos actualizar el instructor." };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Editó el instructor",
    entidadAfectada: "instructores",
    idEntidadAfectada: id,
    detalles: nombre,
  });

  revalidatePath("/admin/instructores");
  revalidatePath("/admin/cursos");
  return { success: true };
}
