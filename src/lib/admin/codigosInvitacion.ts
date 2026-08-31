import { createClient } from "@/lib/supabase/server";
import { estadoCodigo, type EstadoCodigo } from "@/lib/codigoInvitacion";

export type CodigoInvitacion = {
  id: string;
  codigo: string;
  /**
   * Días de acceso que otorga al canjearse. Vive en el propio código desde
   * la migración 20260827000000: antes salía del plan al que apuntaba.
   */
  duracionDias: number;
  fechaVencimiento: string;
  /** Siempre >= 1: no existen los códigos sin tope. */
  limiteUsos: number;
  vecesUsado: number;
  activo: boolean;
  estado: EstadoCodigo;
  creadoPor: string;
  creadoEn: string;
  /** Presente solo en los códigos que salieron de un lote — ver `LoteCodigosInvitacion`. */
  idLote: string | null;
};

export async function getCodigosInvitacion(): Promise<CodigoInvitacion[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("codigos_invitacion")
    .select(
      "id, codigo, duracion_dias, fecha_vencimiento, limite_usos, veces_usado, activo, creado_en, id_lote, admin_creador:perfiles(nombre)",
    )
    .order("creado_en", { ascending: false });

  return (data ?? []).map((fila) => {
    const adminCreador = Array.isArray(fila.admin_creador)
      ? fila.admin_creador[0]
      : fila.admin_creador;

    return {
      id: fila.id as string,
      codigo: fila.codigo as string,
      duracionDias: fila.duracion_dias as number,
      fechaVencimiento: fila.fecha_vencimiento as string,
      limiteUsos: fila.limite_usos as number,
      vecesUsado: fila.veces_usado as number,
      activo: fila.activo as boolean,
      // El estado no se guarda: se deriva de los tres campos que lo
      // determinan, con el mismo orden de precedencia que aplica el RPC de
      // canje (035). Guardarlo obligaría a un cron que lo mantuviera al día.
      estado: estadoCodigo({
        activo: fila.activo as boolean,
        fechaVencimiento: fila.fecha_vencimiento as string,
        limiteUsos: fila.limite_usos as number,
        vecesUsado: fila.veces_usado as number,
      }),
      creadoPor: adminCreador?.nombre ?? "—",
      creadoEn: fila.creado_en as string,
      idLote: (fila.id_lote as string | null) ?? null,
    };
  });
}
