import type { Metadata } from "next";
import { getBitacora } from "@/lib/admin/bitacora";
import { BitacoraTable } from "@/components/admin/bitacora/BitacoraTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Bitácora",
};

export default async function AdminBitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const resultado = await getBitacora(page ? Number(page) : 1);

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Quién hizo qué en el panel: cada acción administrativa queda aquí, sin poder editarse ni
        borrarse.
      </p>
      <BitacoraTable resultado={resultado} />
    </div>
  );
}
