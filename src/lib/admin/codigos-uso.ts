import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { diaEnColombia, sumarDias } from "@/lib/admin/bitacora";
import { diasEntre } from "@/lib/admin/comunidadReportes";
import { lunesDe, semanasRecientes } from "@/lib/admin/semanas";
import { suscripcionDaAcceso } from "@/lib/estadoAcceso";
import type { SemanaGrafica } from "@/lib/admin/grafica";
import type { SuscripcionActual } from "@/lib/suscripcion";

const DIAS_CIFRAS = 30;
/** Desde cuántos días antes del fin del acceso se avisa. */
export const DIAS_AVISO_CODIGOS = 7;
/** Ids por consulta en un `.in()`: cada uuid son 37 caracteres de la URL. */
const LOTE_IDS = 150;

/** Una semana de canjes: una sola barra, y el reparto para el detalle. */
export type SemanaCanjes = SemanaGrafica & { compartidos: number; deLote: number };

export type ResumenCodigos = {
  semanas: SemanaCanjes[];
  canjes30: number;
  /** null si nadie ha canjeado nunca. */
  diasUltimoCanje: number | null;
  /** De quienes canjearon en 30 días, cuántos tienen avance en al menos una clase. */
  empezaron30: number;
  personas30: number;
  /** Personas cuyo acceso de hoy salió de un código. */
  conInvitacion: number;
  seLesAcaba: number;
  /** Por código: cuántos de quienes lo canjearon empezaron a estudiar. */
  estudianPorCodigo: Record<string, number>;
};

export type Canje = {
  idUsuario: string;
  idCodigo: string;
  canjeadoEn: string;
  estado: SuscripcionActual["estado"];
  fechaRenovacion: string | null;
};

/**
 * Agrupa los canjes en semanas y cifras. Pura para probarla sin base.
 *
 * Un canje es una fila de `suscripciones` con `id_codigo_invitacion`: el RPC
 * de canje (035) la crea con `fecha_inicio` en el momento de canjear. Como
 * solo se admite una suscripción activa por usuario (027), el acceso vigente
 * por invitación se cuenta por fila, sin repetir personas.
 */
export function resumirCanjes(
  canjes: Canje[],
  codigosDeLote: Set<string>,
  conAvance: Set<string>,
  ahora: Date = new Date(),
): ResumenCodigos {
  const { semanas: base, primerLunes } = semanasRecientes(ahora);
  const semanas: SemanaCanjes[] = base.map((s) => ({ ...s, compartidos: 0, deLote: 0 }));
  const indice = new Map(semanas.map((s, i) => [s.inicio, i]));
  const desdeCifras = sumarDias(diaEnColombia(ahora), -(DIAS_CIFRAS - 1));

  let canjes30 = 0;
  let diasUltimoCanje: number | null = null;
  const personas30 = new Set<string>();
  let conInvitacion = 0;
  let seLesAcaba = 0;
  const estudianPorCodigo: Record<string, number> = {};

  for (const canje of canjes) {
    const dia = diaEnColombia(canje.canjeadoEn);
    if (dia >= primerLunes) {
      const semana = semanas[indice.get(lunesDe(dia)) ?? -1];
      if (semana) {
        semana.total += 1;
        semana.porSerie.canjes = semana.total;
        if (codigosDeLote.has(canje.idCodigo)) semana.deLote += 1;
        else semana.compartidos += 1;
      }
    }
    if (dia >= desdeCifras) {
      canjes30 += 1;
      personas30.add(canje.idUsuario);
    }
    const dias = diasEntre(canje.canjeadoEn, ahora);
    if (diasUltimoCanje === null || dias < diasUltimoCanje) diasUltimoCanje = dias;

    if (conAvance.has(canje.idUsuario)) {
      estudianPorCodigo[canje.idCodigo] = (estudianPorCodigo[canje.idCodigo] ?? 0) + 1;
    }

    if (suscripcionDaAcceso(canje, ahora)) {
      conInvitacion += 1;
      if (canje.fechaRenovacion && diasEntre(ahora.toISOString(), new Date(canje.fechaRenovacion)) <= DIAS_AVISO_CODIGOS) {
        seLesAcaba += 1;
      }
    }
  }

  return {
    semanas,
    canjes30,
    diasUltimoCanje,
    empezaron30: [...personas30].filter((id) => conAvance.has(id)).length,
    personas30: personas30.size,
    conInvitacion,
    seLesAcaba,
    estudianPorCodigo,
  };
}

/**
 * Cuántas clases empezó cada usuario (filas de `progreso`; el admin las lee
 * por 028). Se pide en tandas para que la URL de `.in()` no crezca sin tope.
 */
export async function clasesPorUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<{ clases: Map<string, number>; error: { message?: string; code?: string } | null }> {
  const clases = new Map<string, number>();
  const unicos = [...new Set(ids)];
  for (let i = 0; i < unicos.length; i += LOTE_IDS) {
    // ponytail: trae una fila por clase empezada; con miles de estudiantes
    // activos conviene una vista que devuelva el conteo por usuario.
    const { data, error } = await supabase.from("progreso").select("id_usuario").in("id_usuario", unicos.slice(i, i + LOTE_IDS));
    if (error) return { clases, error };
    for (const fila of data ?? []) {
      const id = fila.id_usuario as string;
      clases.set(id, (clases.get(id) ?? 0) + 1);
    }
  }
  return { clases, error: null };
}

export async function getResumenCodigos(codigosDeLote: Set<string>): Promise<ResumenCodigos> {
  const supabase = await createClient();

  // ponytail: trae todos los canjes de la historia (hacen falta para contar
  // quién estudia en cada código); con decenas de miles, agregar en una vista.
  const { data, error } = await supabase
    .from("suscripciones")
    .select("id_usuario, id_codigo_invitacion, fecha_inicio, fecha_renovacion, estado")
    .not("id_codigo_invitacion", "is", null);
  lanzarSiFalla(error, "codigos-uso:suscripciones");

  const canjes: Canje[] = (data ?? []).map((fila) => ({
    idUsuario: fila.id_usuario as string,
    idCodigo: fila.id_codigo_invitacion as string,
    canjeadoEn: fila.fecha_inicio as string,
    estado: fila.estado as Canje["estado"],
    fechaRenovacion: (fila.fecha_renovacion as string | null) ?? null,
  }));

  const { clases, error: errorProgreso } = await clasesPorUsuario(supabase, canjes.map((c) => c.idUsuario));
  lanzarSiFalla(errorProgreso, "codigos-uso:progreso");

  return resumirCanjes(canjes, codigosDeLote, new Set(clases.keys()));
}
