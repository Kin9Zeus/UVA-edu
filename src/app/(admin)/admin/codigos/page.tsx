import type { Metadata } from "next";
import { getCodigosInvitacion } from "@/lib/admin/codigosInvitacion";
import { getLotesCodigosInvitacion } from "@/lib/admin/lotesCodigosInvitacion";
import { CodigosPanel } from "@/components/admin/codigos/CodigosPanel";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Códigos de invitación",
};

export default async function AdminCodigosPage() {
  const [codigos, lotes] = await Promise.all([
    getCodigosInvitacion(),
    getLotesCodigosInvitacion(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Códigos de invitación" descripcion="Los códigos que dan acceso a la plataforma sin pagar, sueltos o por lotes." />
      <CodigosPanel codigos={codigos} lotes={lotes} />
    </div>
  );
}
