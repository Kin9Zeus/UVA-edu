import { exportarCodigosInvitacionCsv } from "@/actions/admin/exportarCodigosInvitacion";

/** Descarga el CSV de un lote. Devuelve el error para el aviso, o null. */
export async function descargarCsvLote(loteId: string): Promise<string | null> {
  const respuesta = await exportarCodigosInvitacionCsv(loteId);
  if (respuesta.error || !respuesta.csv || !respuesta.nombreArchivo) {
    return respuesta.error ?? "No pudimos generar el CSV.";
  }
  const url = URL.createObjectURL(new Blob([respuesta.csv], { type: "text/csv;charset=utf-8;" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = respuesta.nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
  return null;
}
