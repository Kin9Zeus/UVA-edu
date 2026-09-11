"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * Descarta un reporte sin tocar el contenido reportado — para cuando el
 * admin revisa y decide que no amerita eliminar (ver /admin/comunidad).
 * Eliminar el contenido en cambio reusa eliminarPostComunidad/
 * eliminarRespuestaComunidad (src/actions/comunidad/eliminar.ts): esa
 * Server Action ya hace todo lo que hace falta (evidencia, motivo, aviso al
 * autor); marcar el reporte como revisado además de eso es responsabilidad
 * de la UI de esa pantalla, no de esta acción.
 */
export async function descartarReporteComunidad(reporteId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("comunidad_reportes").update({ revisado: true }).eq("id", reporteId);
  if (error) return { error: "No pudimos descartar el reporte." };

  revalidatePath("/admin/comunidad");
  return { success: true };
}
