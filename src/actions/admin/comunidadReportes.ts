"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * Cierra todos los reportes pendientes de un contenido sin tocarlo — para
 * cuando el admin revisa y decide dejarlo publicado (ver /admin/comunidad).
 * Es por contenido y no por reporte, igual que eliminar: eliminar
 * (eliminarPostComunidad/eliminarRespuestaComunidad, src/actions/comunidad/
 * eliminar.ts) ya cierra todos los reportes del contenido, y tres personas
 * reportando lo mismo no deberían costar tres decisiones.
 *
 * Cada reporte cerrado le avisa a quien lo hizo que se revisó y no se
 * eliminó (trigger de 103_comunidad_reporte_resuelto_con_veredicto.sql).
 * Queda en la bitácora: si no, "dejarlo" no dejaría rastro de quién decidió.
 */
export async function descartarReportesComunidad(contenido: {
  tipo: "publicación" | "respuesta";
  id: string;
}): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { data, error } = await admin.supabase
    .from("comunidad_reportes")
    .update({ revisado: true })
    .eq(contenido.tipo === "publicación" ? "id_post" : "id_respuesta", contenido.id)
    .eq("revisado", false)
    .select("motivo");
  if (error) return { error: "No pudimos cerrar los reportes." };

  revalidatePath("/admin/comunidad");
  const cerrados = data ?? [];
  if (cerrados.length === 0) return { error: "Estos reportes ya los había resuelto otro administrador." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: `Descartó ${cerrados.length === 1 ? "un reporte" : `${cerrados.length} reportes`} de una ${contenido.tipo} de Comunidad (la dejó publicada)`,
    entidadAfectada: "comunidad_reportes",
    idEntidadAfectada: contenido.id,
    detalles: `Motivos reportados: ${cerrados.map((r) => `«${r.motivo}»`).join("; ")}`,
  });

  return { success: true };
}
