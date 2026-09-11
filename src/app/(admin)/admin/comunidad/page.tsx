import type { Metadata } from "next";
import { getReportesComunidadPendientes } from "@/lib/admin/comunidadReportes";
import { ComunidadReportesTable } from "@/components/admin/comunidad/ComunidadReportesTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Comunidad",
};

export default async function AdminComunidadPage() {
  const reportes = await getReportesComunidadPendientes();

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Reportes pendientes de la Comunidad — cada uno queda acá hasta que un administrador lo elimina o lo
        descarta.
      </p>
      <ComunidadReportesTable reportes={reportes} />
    </div>
  );
}
