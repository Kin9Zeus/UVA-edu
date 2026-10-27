import type { Metadata } from "next";
import { getCuponesAdmin } from "@/lib/admin/cupones";
import { getUsoCupones } from "@/lib/admin/cupones-uso";
import { getPlanesAdmin } from "@/lib/admin/planes";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { CuponesTable } from "@/components/admin/cupones/CuponesTable";
import { ResumenCupones } from "@/components/admin/cupones/ResumenCupones";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Cupones",
};

export default async function AdminCuponesPage() {
  const [cupones, planes] = await Promise.all([getCuponesAdmin(), getPlanesAdmin()]);
  // Con el cobro apagado nadie puede pagar: no se consultan los intentos de
  // pago y la pantalla dice por qué no hay usos, en vez de mostrar ceros.
  const uso = PRECIOS_HABILITADOS && cupones.length > 0 ? await getUsoCupones(cupones) : null;

  const activos = cupones.filter((c) => c.estado === "ACTIVO");

  return (
    <CuponesTable
      cupones={cupones}
      aplicaron={uso?.aplicaron ?? null}
      cobroActivo={PRECIOS_HABILITADOS}
      planes={planes
        .filter((p) => p.activo)
        .map((p) => ({ id: p.id, nombre: p.nombre, precioCentavos: p.precioCentavos, moneda: p.moneda }))}
      encabezado={
        <EncabezadoPagina
          titulo="Cupones"
          descripcion="Descuentos que el estudiante escribe al pagar un plan. Un cupón deja de servir cuando pasa su fecha o cuando se acaban sus usos."
        />
      }
      resumen={
        <ResumenCupones
          uso={uso}
          activos={activos.length}
          vencenEstaSemana={activos.filter((c) => c.diasParaVencer <= 7).length}
        />
      }
    />
  );
}
