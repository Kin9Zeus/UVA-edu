"use server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { getCodigosInvitacion } from "@/lib/admin/codigosInvitacion";
import { construirCsv } from "@/lib/csv";
import { formatFecha } from "@/lib/admin/format";

/**
 * Tope de filas por exportación — mismo criterio que exportarUsuariosCsv:
 * esta acción es un endpoint POST alcanzable por sí mismo, sin la paginación
 * de la pantalla.
 */
const MAX_FILAS_EXPORT = 20_000;

const CABECERAS = [
  "Código",
  "Origen",
  "Días de acceso",
  "Límite de usos",
  "Usos consumidos",
  "Estado",
  "Vence",
  "Creado por",
  "Creado el",
] as const;

const ESTADO_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  VENCIDO: "Vencido",
  AGOTADO: "Agotado",
};

export type ExportResult = { csv?: string; nombreArchivo?: string; error?: string };

/**
 * Devuelve el CSV de códigos de invitación como texto (rev.md: "la
 * exportación se genera en el servidor y se descarga; no construir el
 * archivo en el navegador"). El cliente lo convierte en un Blob y dispara
 * la descarga, mismo patrón que exportarUsuariosCsv.
 *
 * Incluye los dos modos de generación (código único y lote): `idLote`
 * filtra a uno solo cuando se exporta desde el detalle de un lote
 * concreto; sin filtro trae la tabla completa.
 */
export async function exportarCodigosInvitacionCsv(idLote?: string): Promise<ExportResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const todos = await getCodigosInvitacion();
  const codigos = idLote ? todos.filter((codigo) => codigo.idLote === idLote) : todos;

  if (codigos.length === 0) {
    return { error: "No hay códigos que exportar." };
  }
  if (codigos.length > MAX_FILAS_EXPORT) {
    return {
      error: `La exportación supera las ${MAX_FILAS_EXPORT.toLocaleString("es-CO")} filas.`,
    };
  }

  const csv = construirCsv(
    CABECERAS,
    codigos.map((codigo) => [
      codigo.codigo,
      codigo.idLote ? "Lote" : "Único",
      codigo.duracionDias,
      codigo.limiteUsos,
      codigo.vecesUsado,
      ESTADO_LABEL[codigo.estado],
      formatFecha(codigo.fechaVencimiento),
      codigo.creadoPor,
      formatFecha(codigo.creadoEn),
    ]),
  );

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: idLote ? "Exportó un lote de códigos de invitación a CSV" : "Exportó los códigos de invitación a CSV",
    entidadAfectada: "codigos_invitacion",
    idEntidadAfectada: idLote,
    detalles: `${codigos.length} código(s)`,
  });

  const hoy = new Date().toISOString().slice(0, 10);
  return { csv, nombreArchivo: `codigos-invitacion-uva-${hoy}.csv` };
}
