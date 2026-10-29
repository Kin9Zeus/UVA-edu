import type { Metadata } from "next";
import { getPlanesAdmin } from "@/lib/admin/planes";
import { getVentasPlanes } from "@/lib/admin/planes-ventas";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { PlanesTable } from "@/components/admin/planes/PlanesTable";
import { ResumenPlanes } from "@/components/admin/planes/ResumenPlanes";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Planes",
};

export default async function AdminPlanesPage() {
  const planes = await getPlanesAdmin();
  // Con el cobro apagado no hay ventas que leer: la pantalla lo dice en vez
  // de mostrar ceros que parecen un negocio parado.
  const ventas = PRECIOS_HABILITADOS && planes.length > 0 ? await getVentasPlanes(planes) : null;

  return (
    <PlanesTable
      planes={planes}
      ventas={ventas}
      cobroActivo={PRECIOS_HABILITADOS}
      encabezado={
        <EncabezadoPagina
          titulo="Planes"
          descripcion="Lo que compra el estudiante para entrar a todo el catálogo durante unos días. Retirar un plan lo quita de la venta, pero no afecta a quien ya lo pagó."
        />
      }
      resumen={<ResumenPlanes ventas={ventas} />}
    />
  );
}
