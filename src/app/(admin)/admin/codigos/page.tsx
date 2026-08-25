import type { Metadata } from "next";
import { getCodigosInvitacion, getPlanesParaCodigos } from "@/lib/admin/codigosInvitacion";
import { CodigosTable } from "@/components/admin/codigos/CodigosTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Códigos de invitación",
};

export default async function AdminCodigosPage() {
  const [codigos, planes] = await Promise.all([
    getCodigosInvitacion(),
    getPlanesParaCodigos(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <CodigosTable codigos={codigos} planes={planes} />
    </div>
  );
}
