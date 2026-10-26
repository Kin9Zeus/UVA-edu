import type { Metadata } from "next";
import { getCuponesAdmin } from "@/lib/admin/cupones";
import { CuponesTable } from "@/components/admin/cupones/CuponesTable";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Cupones",
};

export default async function AdminCuponesPage() {
  const cupones = await getCuponesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Cupones"
        descripcion="Cupones de descuento para el pago. Se aplican sobre el precio del plan al pagar. Un cupón deja de servir cuando pasa su fecha o cuando alcanza su límite de usos."
      />
      <CuponesTable cupones={cupones} />
    </div>
  );
}
