import type { Metadata } from "next";
import { getPlanesAdmin } from "@/lib/admin/planes";
import { PlanesTable } from "@/components/admin/planes/PlanesTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Planes",
};

export default async function AdminPlanesPage() {
  const planes = await getPlanesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Planes de membresía del catálogo — un plan inactivo deja de ofrecerse, pero las suscripciones que ya
        lo tienen siguen mostrándolo.
      </p>
      <PlanesTable planes={planes} />
    </div>
  );
}
