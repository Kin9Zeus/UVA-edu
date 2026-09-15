"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * Descarta un reporte sin tocar el contenido reportado — para cuando el
 * admin revisa y decide que no amerita eliminar (ver /admin/comunidad).
 * Eliminar el contenido en cambio reusa eliminarPostComunidad/
 * eliminarRespuestaComunidad (src/actions/comunidad/eliminar.ts): esa
 * Server Action ya hace todo lo que hace falta (evidencia, motivo, aviso al
 * autor); marcar el reporte como revisado además de eso es responsabilidad
 * de la UI de esa pantalla, no de esta acción.
 *
 * Antes esta decisión no dejaba ningún rastro: solo la RUTA que elimina
 * contenido pasa por eliminarPostComunidad/eliminarRespuestaComunidad, que
 * sí registran bitácora — "descartar" (la moderación no siempre termina en
 * un borrado) se quedaba sin auditoría, así que un admin no tenía forma de
 * ver después quién revisó qué reporte ni qué decidió.
 */
export async function descartarReporteComunidad(
  reporteId: string,
  /** Motivo original del reporte — solo para dejarlo legible en la bitácora,
   * sin tener que abrir la fila de comunidad_reportes aparte. */
  motivoReporte: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("comunidad_reportes").update({ revisado: true }).eq("id", reporteId);
  if (error) return { error: "No pudimos descartar el reporte." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Descartó un reporte de Comunidad (sin eliminar el contenido)",
    entidadAfectada: "comunidad_reportes",
    idEntidadAfectada: reporteId,
    detalles: `Motivo reportado: ${motivoReporte}`,
  });

  revalidatePath("/admin/comunidad");
  return { success: true };
}
