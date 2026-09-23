import type { Metadata } from "next";
import { getBitacora } from "@/lib/admin/bitacora";
import { BitacoraTable } from "@/components/admin/bitacora/BitacoraTable";
import { fechaDeFiltro, numeroDePagina, type ParametroUrl } from "@/lib/parametros-url";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Bitácora",
};

export default async function AdminBitacoraPage({
  searchParams,
}: {
  // Tipo real (un parámetro repetido llega como arreglo): ver lib/parametros-url.ts.
  searchParams: Promise<{ page?: ParametroUrl; desde?: ParametroUrl; hasta?: ParametroUrl }>;
}) {
  const { page, desde, hasta } = await searchParams;
  // Sin tope de páginas: la bitácora no pasa por unstable_cache, así que no
  // hay claves de caché que acotar (el motivo de PAGINA_MAXIMA).
  const resultado = await getBitacora(
    numeroDePagina(page, Number.MAX_SAFE_INTEGER),
    fechaDeFiltro(desde),
    fechaDeFiltro(hasta),
  );

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
