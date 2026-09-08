"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodigosTable } from "@/components/admin/codigos/CodigosTable";
import { LotesTable } from "@/components/admin/codigos/LotesTable";
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
 * Lo que NO se toca al remover uno: RedimidoresButton y la exportación CSV
 * son transversales a los dos modos.
 *
 * Ya NO hay suscripción en tiempo real (useCodigosRealtime, retirada en
 * D-13 de AUDIT-2026-09-08-base-de-datos.md). Costaba, medido en
 * pg_stat_statements, 74 792 llamadas al decodificador de WAL con tráfico
 * casi nulo — Supabase Realtime reevalúa RLS por cada fila que cambia y por
 * cada suscriptor conectado, y un lote puede insertar hasta 500 filas de
 * una vez (MAX_LOTE, lotesCodigosInvitacion.ts). El único caso que cubría
 * —enterarse de un canje hecho por un estudiante en otra sesión mientras
 * esta pantalla sigue abierta— no tiene urgencia de segundo a segundo:
 * recargar la pestaña alcanza, igual que en el resto del panel admin, que
 * no usa Realtime en ninguna otra pantalla. Las acciones del propio
 * administrador (crear código, crear lote, desactivar) se siguen viendo al
 * instante vía `revalidatePath`, sin cambios.
 */
export function CodigosPanel({
  codigos,
  lotes,
}: {
  codigos: CodigoInvitacion[];
  lotes: LoteCodigosInvitacion[];
}) {
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
