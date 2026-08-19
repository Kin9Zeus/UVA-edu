"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import type { AdminActionResult } from "@/actions/admin/categorias";

const IMAGEN_PLACEHOLDER = "placeholder://curso-sin-portada";

export type NivelCurso = "BASICO" | "INTERMEDIO" | "AVANZADO";

export async function crearCurso(input: {
  titulo: string;
  descripcion: string;
  categoriaId: string;
  nivel: NivelCurso;
  instructor: string;
  publicar: boolean;
}): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const titulo = input.titulo.trim();
  const instructor = input.instructor.trim();
  if (!titulo) return { error: "El nombre del curso es obligatorio." };
  if (!input.categoriaId) return { error: "Selecciona una categoría." };
  if (!instructor) return { error: "El instructor es obligatorio." };

  const { data, error } = await admin.supabase
    .from("cursos")
    .insert({
      titulo,
      descripcion: input.descripcion.trim(),
      imagen_portada: IMAGEN_PLACEHOLDER,
      id_categoria: input.categoriaId,
      nivel: input.nivel,
      instructor,
      mostrado: input.publicar,
      id_admin_creador: admin.adminId,
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear el curso." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: input.publicar ? "Creó y publicó un curso" : "Creó un curso en borrador",
    entidadAfectada: "cursos",
    idEntidadAfectada: data.id,
    detalles: titulo,
  });

  revalidatePath("/admin/cursos");
  return { success: true, id: data.id };
}

export async function actualizarInfoCurso(
  cursoId: string,
  input: { titulo: string; descripcion: string; categoriaId: string; nivel: NivelCurso },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const titulo = input.titulo.trim();
  if (!titulo) return { error: "El nombre del curso es obligatorio." };

  const { error } = await admin.supabase
    .from("cursos")
    .update({
      titulo,
      descripcion: input.descripcion.trim(),
      id_categoria: input.categoriaId,
      nivel: input.nivel,
    })
    .eq("id", cursoId);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  revalidatePath("/admin/cursos");
  return { success: true };
}

export async function actualizarConfiguracionCurso(
  cursoId: string,
  input: { mostrado: boolean; destacado: boolean; ordenVisualizacion: number },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase
    .from("cursos")
    .update({
      mostrado: input.mostrado,
      destacado: input.destacado,
      orden_visualizacion: input.ordenVisualizacion,
    })
    .eq("id", cursoId);

  if (error) return { error: "No pudimos guardar la configuración." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  revalidatePath("/admin/cursos");
  return { success: true };
}

export async function alternarPublicacionCurso(cursoId: string, mostrado: boolean): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("cursos").update({ mostrado }).eq("id", cursoId);
  if (error) return { error: "No pudimos actualizar el curso." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: mostrado ? "Publicó un curso" : "Despublicó un curso",
    entidadAfectada: "cursos",
    idEntidadAfectada: cursoId,
  });

  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function eliminarCurso(cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("cursos").delete().eq("id", cursoId);
  if (error) return { error: "No pudimos eliminar el curso." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Eliminó un curso",
    entidadAfectada: "cursos",
    idEntidadAfectada: cursoId,
  });

  revalidatePath("/admin/cursos");
  return { success: true };
}

// ------------------------------------------------------------
// Módulos
// ------------------------------------------------------------

export async function crearModulo(cursoId: string, titulo: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const tituloLimpio = titulo.trim();
  if (!tituloLimpio) return { error: "El nombre del módulo es obligatorio." };

  const { count } = await admin.supabase
    .from("modulos")
    .select("id", { count: "exact", head: true })
    .eq("id_curso", cursoId);

  const { error } = await admin.supabase.from("modulos").insert({
    id_curso: cursoId,
    titulo: tituloLimpio,
    orden: count ?? 0,
  });

  if (error) return { error: "No pudimos crear el módulo." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function eliminarModulo(moduloId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("modulos").delete().eq("id", moduloId);
  if (error) return { error: "No pudimos eliminar el módulo." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function reordenarModulos(
  cursoId: string,
  items: { id: string; orden: number }[],
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const resultados = await Promise.all(
    items.map((item) => admin.supabase.from("modulos").update({ orden: item.orden }).eq("id", item.id)),
  );

  if (resultados.some((resultado) => resultado.error)) {
    return { error: "No pudimos guardar el nuevo orden de los módulos." };
  }

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

// ------------------------------------------------------------
// Lecciones
// ------------------------------------------------------------

export async function crearLeccion(
  moduloId: string,
  cursoId: string,
  titulo: string,
): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const tituloLimpio = titulo.trim();
  if (!tituloLimpio) return { error: "El nombre de la lección es obligatorio." };

  const { count } = await admin.supabase
    .from("lecciones")
    .select("id", { count: "exact", head: true })
    .eq("id_modulo", moduloId);

  const { data, error } = await admin.supabase
    .from("lecciones")
    .insert({
      id_modulo: moduloId,
      titulo: tituloLimpio,
      orden: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true, id: data.id };
}

export async function actualizarLeccion(
  leccionId: string,
  cursoId: string,
  input: { titulo: string; duracion: number | null; resumen: string },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const titulo = input.titulo.trim();
  if (!titulo) return { error: "El nombre de la lección es obligatorio." };

  const { error } = await admin.supabase
    .from("lecciones")
    .update({ titulo, duracion: input.duracion, resumen: input.resumen.trim() || null })
    .eq("id", leccionId);

  if (error) return { error: "No pudimos guardar la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function eliminarLeccion(leccionId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("lecciones").delete().eq("id", leccionId);
  if (error) return { error: "No pudimos eliminar la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function reordenarLecciones(
  cursoId: string,
  items: { id: string; orden: number }[],
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const resultados = await Promise.all(
    items.map((item) => admin.supabase.from("lecciones").update({ orden: item.orden }).eq("id", item.id)),
  );

  if (resultados.some((resultado) => resultado.error)) {
    return { error: "No pudimos guardar el nuevo orden de las lecciones." };
  }

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}
