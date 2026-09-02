import { createClient } from "@/lib/supabase/server";
import { estadoCodigo } from "@/lib/codigoInvitacion";

/**
 * Lectura de la opción "Lote de códigos" (rev.md: generar N códigos
 * individuales de una vez, alternativa a "código único con cupo N" —
 * src/lib/admin/codigosInvitacion.ts). Archivo separado a propósito: si la
 * decisión de negocio pendiente descarta este modo, se borra este archivo,
 * `src/actions/admin/lotesCodigosInvitacion.ts` y su pestaña en la pantalla,
 * sin tocar el modo de código único.
 */
export type LoteCodigosInvitacion = {
  id: string;
  /** Cuántos se PIDIERON generar al crear el lote — un hecho fijo, nunca
   * cambia (ver el comentario de esta columna en schema.prisma). No lo uses
   * como denominador de nada que dependa de cuántas filas quedan hoy: para
   * eso está `totalActual`. */
  cantidad: number;
  duracionDias: number;
  fechaVencimiento: string;
  creadoPor: string;
  creadoEn: string;
  /** Códigos del lote que TODAVÍA EXISTEN (no se han eliminado). A
   * diferencia de `cantidad`, baja cuando se borra un código sin usar
   * (eliminarCodigoInvitacion) — es el número correcto para "cuántos hay"
   * y para el denominador de `canjeados`. */
  totalActual: number;
  /** Códigos del lote ya canjeados por alguien (cada uno, a lo sumo una vez). */
  canjeados: number;
  /** Códigos del lote que todavía se pueden canjear (ni usados, ni vencidos, ni desactivados). */
  activos: number;
};

/**
 * Lista los lotes con sus totales agregados. La agregación se hace en JS
 * después de traer los códigos del lote (no con un `group by` en
 * PostgREST, que no lo soporta) — aceptable porque un lote tiene como
 * mucho unos cientos de códigos (MAX_LOTE en el Server Action) y el panel
 * no pagina esta lista.
 */
export async function getLotesCodigosInvitacion(): Promise<LoteCodigosInvitacion[]> {
  const supabase = await createClient();

  const { data: lotes } = await supabase
    .from("lotes_codigos_invitacion")
    .select("id, cantidad, duracion_dias, fecha_vencimiento, creado_en, admin_creador:perfiles(nombre)")
    .order("creado_en", { ascending: false });

  if (!lotes || lotes.length === 0) return [];

  const { data: codigos } = await supabase
    .from("codigos_invitacion")
    .select("id_lote, veces_usado, activo, fecha_vencimiento, limite_usos")
    .in(
      "id_lote",
      lotes.map((lote) => lote.id),
    );

  const agregadosPorLote = new Map<string, { totalActual: number; canjeados: number; activos: number }>();
  for (const codigo of codigos ?? []) {
    const idLote = codigo.id_lote as string;
    const actual = agregadosPorLote.get(idLote) ?? { totalActual: 0, canjeados: 0, activos: 0 };

    actual.totalActual += 1;
    if ((codigo.veces_usado as number) > 0) actual.canjeados += 1;

    const estado = estadoCodigo({
      activo: codigo.activo as boolean,
      fechaVencimiento: codigo.fecha_vencimiento as string,
      limiteUsos: codigo.limite_usos as number,
      vecesUsado: codigo.veces_usado as number,
    });
    if (estado === "ACTIVO") actual.activos += 1;

    agregadosPorLote.set(idLote, actual);
  }

  return lotes.map((lote) => {
    const adminCreador = Array.isArray(lote.admin_creador) ? lote.admin_creador[0] : lote.admin_creador;
    const agregados =
      agregadosPorLote.get(lote.id as string) ?? { totalActual: 0, canjeados: 0, activos: 0 };

    return {
      id: lote.id as string,
      cantidad: lote.cantidad as number,
      duracionDias: lote.duracion_dias as number,
      fechaVencimiento: lote.fecha_vencimiento as string,
      creadoPor: adminCreador?.nombre ?? "—",
      creadoEn: lote.creado_en as string,
      totalActual: agregados.totalActual,
      canjeados: agregados.canjeados,
      activos: agregados.activos,
    };
  });
}
