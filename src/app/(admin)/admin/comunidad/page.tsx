import type { Metadata } from "next";
import { getReportesComunidadPendientes } from "@/lib/admin/comunidadReportes";
import { ComunidadReportesTable } from "@/components/admin/comunidad/ComunidadReportesTable";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Comunidad",
};

export default async function AdminComunidadPage() {
  const reportes = await getReportesComunidadPendientes();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Comunidad"
        descripcion="Reportes pendientes de la Comunidad. Cada uno queda aquí hasta que un administrador lo elimina o lo descarta."
      />
      <ComunidadReportesTable reportes={reportes} />
    </div>
  );
}
