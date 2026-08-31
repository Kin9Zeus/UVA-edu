import type { Metadata } from "next";
import { getCodigosInvitacion } from "@/lib/admin/codigosInvitacion";
import { getLotesCodigosInvitacion } from "@/lib/admin/lotesCodigosInvitacion";
import { CodigosPanel } from "@/components/admin/codigos/CodigosPanel";

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
      <CodigosPanel codigos={codigos} lotes={lotes} />
    </div>
  );
}
