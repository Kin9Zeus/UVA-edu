"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { slugificar, slugDisponible } from "@/lib/slug";
import { planificarReasignacion } from "@/lib/admin/reasignarCategoria";

export type AdminActionResult = { error?: string; success?: boolean };

/**
 * Slug libre para `nombre`, ignorando la propia categoría al editar
 * (`exceptoId`) para que reguardar sin cambiar el nombre no le agregue un
 * sufijo contra sí misma.
 */
async function generarSlug(
  supabase: SupabaseClient,
  nombre: string,
  exceptoId?: string,
): Promise<string> {
  const base = slugificar(nombre);

  let consulta = supabase.from("categorias").select("slug").like("slug", `${base}%`);
  if (exceptoId) consulta = consulta.neq("id", exceptoId);
  const { data } = await consulta;

  return slugDisponible(base, (data ?? []).map((fila) => fila.slug as string));
}

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
      slug: await generarSlug(admin.supabase, nombre),
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

  // El slug se regenera al renombrar, como pide el spec ("generado
  // automáticamente desde el nombre"): así corregir un nombre mal escrito
  // también corrige la URL. El costo es que un enlace externo al slug viejo
  // deja de resolver — los enlaces internos no se ven afectados porque
  // todos se arman con los datos actuales, y las rutas del catálogo siguen
  // aceptando el UUID.
  const { error } = await admin.supabase
    .from("categorias")
    .update({
      nombre,
      slug: await generarSlug(admin.supabase, nombre, id),
      descripcion: input.descripcion.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar la categoría." };

  revalidatePath("/admin/categorias");
  revalidatePath("/catalogo");
  revalidatePath("/dashboard/catalogo");
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

/**
 * Mueve los cursos de `id` a `destinoId` y después elimina la categoría.
 *
 * `curso_categorias.id_categoria` es ON DELETE RESTRICT: una categoría con
 * cursos no se puede borrar, y sin este flujo el administrador quedaba
 * atascado (el error decía "reasígnalos primero" sin ofrecer dónde).
 *
 * Los tres pasos no van en una transacción — supabase-js no las expone —,
 * así que están ordenados para que cualquier corte a mitad deje un estado
 * benigno y reintentable:
 *
 *  1. Se sueltan las filas de los cursos que YA estaban en el destino —
 *     un curso nunca queda dos veces en la misma categoría. Perder ahí la
 *     categoría vieja no les quita nada: el destino ya lo tienen. Además
 *     evita chocar contra el UNIQUE (id_curso, id_categoria) en el paso 2.
 *     El reparto lo decide planificarReasignacion(), que está probada en
 *     lib/admin/reasignarCategoria.test.ts.
 *  2. Las filas restantes se repuntan al destino. Si el paso 3 no llega, la
 *     categoría queda vacía pero existiendo, y volver a eliminarla funciona.
 *  3. Se elimina la categoría, ya sin cursos que la retengan.
 */
export async function reasignarYEliminarCategoria(
  id: string,
  destinoId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  if (!destinoId) return { error: "Selecciona la categoría de destino." };
  if (destinoId === id) return { error: "La categoría de destino debe ser otra." };

  const { data: destino } = await admin.supabase
    .from("categorias")
    .select("nombre")
    .eq("id", destinoId)
    .maybeSingle();

  if (!destino) return { error: "La categoría de destino ya no existe." };

  const [{ data: filasOrigen, error: errorOrigen }, { data: filasDestino, error: errorDestino }] =
    await Promise.all([
      admin.supabase.from("curso_categorias").select("id, id_curso").eq("id_categoria", id),
      admin.supabase.from("curso_categorias").select("id_curso").eq("id_categoria", destinoId),
    ]);

  if (errorOrigen || errorDestino) return { error: "No pudimos leer los cursos de la categoría." };

  const { soltar, mover } = planificarReasignacion(
    (filasOrigen ?? []).map((fila) => ({ id: fila.id as string, idCurso: fila.id_curso as string })),
    (filasDestino ?? []).map((fila) => fila.id_curso as string),
  );

  if (soltar.length > 0) {
    const { error } = await admin.supabase.from("curso_categorias").delete().in("id", soltar);
    if (error) return { error: "No pudimos reasignar los cursos." };
  }

  if (mover.length > 0) {
    const { error } = await admin.supabase
      .from("curso_categorias")
      .update({ id_categoria: destinoId })
      .in("id", mover);
    if (error) return { error: "No pudimos reasignar los cursos." };
  }

  const { error } = await admin.supabase.from("categorias").delete().eq("id", id);
  if (error) {
    return {
      error: "Los cursos se movieron, pero no pudimos eliminar la categoría. Intenta de nuevo.",
    };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Eliminó una categoría y reasignó sus cursos",
    entidadAfectada: "categorias",
    idEntidadAfectada: id,
    detalles: `${filasOrigen?.length ?? 0} curso(s) movidos a "${destino.nombre}"`,
  });

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/cursos");
  revalidatePath("/catalogo");
  revalidatePath("/dashboard/catalogo");
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
