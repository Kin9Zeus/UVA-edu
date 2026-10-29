import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { getReportesComunidadPendientes } from "@/lib/admin/comunidadReportes";
import { getResumenComunidad } from "@/lib/admin/comunidad-actividad";
import { ColaReportes } from "@/components/admin/comunidad/ColaReportes";
import { RUTA_DECISIONES_COMUNIDAD } from "@/lib/admin/bitacora-tipos";
import { ResumenComunidad } from "@/components/admin/comunidad/ResumenComunidad";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Comunidad",
};

export default async function AdminComunidadPage() {
  const [contenidos, resumen] = await Promise.all([getReportesComunidadPendientes(), getResumenComunidad()]);
  const pendientes = contenidos.reduce((suma, c) => suma + c.reportes.length, 0);
  const diasMasAntiguo = contenidos.length ? Math.max(...contenidos.map((c) => c.reportes[0].dias)) : null;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">
          <EncabezadoPagina
            titulo="Comunidad"
            descripcion="Lo que los estudiantes reportan en la comunidad. Cada reporte queda aquí hasta que eliminas el contenido o decides dejarlo."
          />
        </div>
        <Link href={RUTA_DECISIONES_COMUNIDAD} className={buttonVariants({ className: "max-sm:w-full" })}>
          <History aria-hidden />
          Decisiones anteriores
        </Link>
      </div>
      <ResumenComunidad resumen={resumen} pendientes={pendientes} diasMasAntiguo={diasMasAntiguo} />
      <ColaReportes contenidos={contenidos} />
    </div>
  );
}
