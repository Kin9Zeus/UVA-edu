import type { Metadata } from "next";
import { getCuponesAdmin } from "@/lib/admin/cupones";
import { CuponesTable } from "@/components/admin/cupones/CuponesTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Cupones",
};

export default async function AdminCuponesPage() {
  const cupones = await getCuponesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Cupones de descuento del checkout — se aplican sobre el precio del plan al pagar. Un
        cupón deja de servir cuando pasa su fecha o cuando alcanza su límite de usos.
      </p>
      <CuponesTable cupones={cupones} />
    </div>
  );
}
