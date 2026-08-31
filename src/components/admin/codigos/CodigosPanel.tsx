"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodigosTable } from "@/components/admin/codigos/CodigosTable";
import { LotesTable } from "@/components/admin/codigos/LotesTable";
import { useCodigosRealtime } from "@/components/admin/codigos/useCodigosRealtime";
import type { CodigoInvitacion } from "@/lib/admin/codigosInvitacion";
import type { LoteCodigosInvitacion } from "@/lib/admin/lotesCodigosInvitacion";

/**
 * Único punto donde conviven los dos modos de generación de códigos de
 * invitación (rev.md deja pendiente cuál usar en producción: "código único
 * con cupo N" vs. "lote de N códigos individuales"). Si la decisión
 * descarta uno de los dos:
 *
 *   - Quitar su <TabsTrigger>/<TabsContent> y el import de aquí.
 *   - Borrar su tabla, su(s) diálogo(s) y su Server Action:
 *       único -> CodigosTable.tsx, CodigoFormDialog.tsx, actions/admin/codigosInvitacion.ts
 *       lote  -> LotesTable.tsx, LoteFormDialog.tsx, actions/admin/lotesCodigosInvitacion.ts,
 *                lib/admin/lotesCodigosInvitacion.ts
 *   - El modo "lote" además tiene su propia migración y RPC
 *     (prisma/migrations/20260831000000_lotes_codigos_invitacion,
 *     supabase/sql/044-046) — solo hace falta revertirlos si se quiere
 *     limpiar la base, no para que la pantalla deje de ofrecerlo.
 *
 * Lo que NO se toca al remover uno: RedimidoresButton, la exportación CSV
 * y el realtime son transversales a los dos modos.
 */
export function CodigosPanel({
  codigos,
  lotes,
}: {
  codigos: CodigoInvitacion[];
  lotes: LoteCodigosInvitacion[];
}) {
  useCodigosRealtime();

  const codigosUnicos = codigos.filter((codigo) => codigo.idLote === null);
  const codigosDeLote = codigos.filter((codigo) => codigo.idLote !== null);

  return (
    <Tabs defaultValue="unico">
      <TabsList>
        <TabsTrigger value="unico">Código único</TabsTrigger>
        <TabsTrigger value="lote">Lote de códigos</TabsTrigger>
      </TabsList>

      <TabsContent value="unico" className="pt-[18px]">
        <CodigosTable codigos={codigosUnicos} />
      </TabsContent>

      <TabsContent value="lote" className="pt-[18px]">
        <LotesTable lotes={lotes} codigos={codigosDeLote} />
      </TabsContent>
    </Tabs>
  );
}
