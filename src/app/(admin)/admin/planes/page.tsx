import type { Metadata } from "next";
import { getPlanesAdmin } from "@/lib/admin/planes";
import { PlanesTable } from "@/components/admin/planes/PlanesTable";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Planes",
};

export default async function AdminPlanesPage() {
  const planes = await getPlanesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Planes"
        descripcion="Planes de membresía del catálogo. Un plan inactivo deja de ofrecerse, pero las suscripciones que ya lo tienen siguen mostrándolo."
      />
      <PlanesTable planes={planes} />
    </div>
  );
}
