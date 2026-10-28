import type { Metadata } from "next";
import { getCodigosInvitacion } from "@/lib/admin/codigosInvitacion";
import { getLotesCodigosInvitacion } from "@/lib/admin/lotesCodigosInvitacion";
import { DIAS_AVISO_CODIGOS, getResumenCodigos } from "@/lib/admin/codigos-uso";
import { CodigosLista } from "@/components/admin/codigos/CodigosLista";
import { ResumenCodigos } from "@/components/admin/codigos/ResumenCodigos";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Códigos de invitación",
};

export default async function AdminCodigosPage() {
  const [codigos, lotes] = await Promise.all([getCodigosInvitacion(), getLotesCodigosInvitacion()]);
  const compartidos = codigos.filter((c) => c.idLote === null);
  const deLote = codigos.filter((c) => c.idLote !== null);
  const resumen = await getResumenCodigos(new Set(deLote.map((c) => c.id)));

  // Cupos: lo que les queda a los compartidos activos, más cada código de lote
  // que todavía se puede canjear (uno por persona).
  let cupos = 0;
  let cuposPorVencer = 0;
  for (const codigo of codigos) {
    if (codigo.estado !== "ACTIVO") continue;
    const libres = codigo.limiteUsos - codigo.vecesUsado;
    cupos += libres;
    if (codigo.diasParaVencer <= DIAS_AVISO_CODIGOS) cuposPorVencer += libres;
  }

  return (
    <CodigosLista
      codigos={compartidos}
      lotes={lotes}
      codigosDeLote={deLote}
      estudianPorCodigo={resumen.estudianPorCodigo}
      encabezado={
        <EncabezadoPagina
          titulo="Códigos de invitación"
          descripcion="Hoy son la única forma de entrar a la plataforma. Cada código da unos días de acceso, sin pagar, contados desde que se canjea."
        />
      }
      resumen={<ResumenCodigos resumen={resumen} cupos={cupos} cuposPorVencer={cuposPorVencer} />}
    />
  );
}
