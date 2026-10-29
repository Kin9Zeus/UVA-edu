import type { Metadata } from "next";
import { getDashboardData } from "@/lib/admin/dashboard";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";
import { ComoVa, PagosInicio } from "@/components/admin/inicio/GraficasInicio";
import { ParaAtender } from "@/components/admin/inicio/ParaAtender";
import { CursosAhora, Embudo, LoUltimo } from "@/components/admin/inicio/BloquesInicio";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Inicio",
};

export default async function AdminDashboardPage() {
  const datos = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Inicio" descripcion="Cómo va U.V.A. y qué necesita tu atención." />

      {/* En celular, Para atender va primero (cerrado); desde xl, a la derecha
          de la gráfica y Pagos para que las dos columnas terminen parejas. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5 max-xl:order-2">
          <ComoVa semanas={datos.semanas} />
          <PagosInicio pagos={datos.pagos} />
        </div>
        <ParaAtender pendientes={datos.pendientes} className="max-xl:order-1" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Embudo embudo={datos.embudo} accesoHoy={datos.accesoHoy} />
        <CursosAhora cursos={datos.cursos30} />
      </div>

      <LoUltimo actividad={datos.actividad} />
    </div>
  );
}
