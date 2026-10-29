"use server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { BITACORA_VENTANA, getBitacora, registrarBitacora, type FiltrosBitacora } from "@/lib/admin/bitacora";
import { TIPOS_BITACORA } from "@/lib/admin/bitacora-tipos";
import { construirCsv } from "@/lib/csv";
import type { ExportResult } from "@/actions/admin/exportarUsuarios";

const CABECERAS = ["Fecha y hora", "Administrador", "Acción", "Tipo", "Sensible", "Sobre", "Detalle"] as const;

const NOMBRE_TIPO = Object.fromEntries(TIPOS_BITACORA.map((t) => [t.clave, t.nombre]));

const fechaHora = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * La bitácora como CSV, con los mismos filtros que la pantalla. Para un
 * auditor o un reclamo de Habeas Data. Es una exportación más, así que queda
 * registrada en la propia bitácora (y cuenta como sensible).
 *
 * Server Action y no Route Handler: CLAUDE.md §3.1 reserva /api/ para
 * webhooks. `requireAdmin()` es la puerta: un Server Action es un POST
 * alcanzable por sí mismo y la protección de la página no lo cubre.
 */
export async function exportarBitacoraCsv(filtros: Omit<FiltrosBitacora, "mostrar">): Promise<ExportResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { entradas, total, truncada } = await getBitacora({ ...filtros, mostrar: BITACORA_VENTANA });
  if (total === 0) return { error: "No hay acciones que coincidan con los filtros." };
  if (truncada) {
    return {
      error: `Hay más de ${BITACORA_VENTANA.toLocaleString("es-CO")} acciones en ese rango. Acota las fechas para exportarlas todas.`,
    };
  }

  const csv = construirCsv(
    CABECERAS,
    entradas.map((e) => [
      fechaHora.format(new Date(e.creadoEn)),
      e.adminNombre,
      e.accion,
      NOMBRE_TIPO[e.tipo] ?? e.tipo,
      e.sensible ? "Sí" : "No",
      e.sujeto ?? "",
      e.detalles ?? "",
    ]),
  );

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Exportó la bitácora a CSV",
    entidadAfectada: "bitacora_administrativa",
    detalles: `${entradas.length} ${entradas.length === 1 ? "acción" : "acciones"}`,
  });

  const hoy = new Date().toISOString().slice(0, 10);
  return { csv, nombreArchivo: `bitacora-uva-${hoy}.csv` };
}
