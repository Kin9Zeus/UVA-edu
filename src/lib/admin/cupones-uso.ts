import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { diaEnColombia, sumarDias } from "@/lib/admin/bitacora";
import { elegirSeries, lunesDe, OTROS, SEMANAS_GRAFICA, semanasRecientes } from "@/lib/admin/semanas";
import type { SemanaGrafica, SerieGrafica } from "@/lib/admin/grafica";

export const CUPONES_SEMANAS = SEMANAS_GRAFICA;
const DIAS_CIFRAS = 30;

export type UsoCupones = {
  semanas: SemanaGrafica[];
  /** Hasta 4 cupones con nombre y, si hay más, "Otros". */
  series: SerieGrafica[];
  /** Cuántas veces se aplicó cada cupón en un intento de pago, pagado o no. */
  aplicaron: Record<string, number>;
  pagosConCupon: number;
  pagosTotales: number;
  /** Solo pagos en COP: sumar monedas distintas daría una cifra falsa. */
  recaudadoCop: number;
};

export type IntentoConCupon = {
  idCupon: string;
  estado: string;
  montoCentavos: number;
  moneda: string;
  /** Para un APROBADO es el momento de la aprobación: es el último UPDATE. */
  actualizadoEn: string;
};

/**
 * Agrupa los intentos con cupón en semanas, series y cifras. Pura para poder
 * probarla sin base.
 *
 * Los colores siguen al cupón, no a su puesto: entre los 4 con más usos de la
 * ventana, el más antiguo toma la serie 1 (`elegirSeries`).
 */
export function resumirUsoCupones(
  intentos: IntentoConCupon[],
  cupones: { id: string; codigo: string; creadoEn: string }[],
  pagosTotales: number,
  ahora: Date = new Date(),
): UsoCupones {
  const hoy = diaEnColombia(ahora);
  const { semanas, primerLunes } = semanasRecientes(ahora);
  const desdeCifras = sumarDias(hoy, -(DIAS_CIFRAS - 1));

  const aplicaron: Record<string, number> = {};
  const aprobadosEnVentana: { idCupon: string; lunes: string }[] = [];
  let pagosConCupon = 0;
  let recaudadoCop = 0;

  for (const intento of intentos) {
    aplicaron[intento.idCupon] = (aplicaron[intento.idCupon] ?? 0) + 1;
    if (intento.estado !== "APROBADO") continue;
    const dia = diaEnColombia(intento.actualizadoEn);
    if (dia >= primerLunes) aprobadosEnVentana.push({ idCupon: intento.idCupon, lunes: lunesDe(dia) });
    if (dia >= desdeCifras) {
      pagosConCupon += 1;
      if (intento.moneda === "COP") recaudadoCop += intento.montoCentavos;
    }
  }

  const usosPorCupon = new Map<string, number>();
  for (const { idCupon } of aprobadosEnVentana) usosPorCupon.set(idCupon, (usosPorCupon.get(idCupon) ?? 0) + 1);
  const porAntiguedad = [...cupones].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  const { series, nombradas } = elegirSeries(
    usosPorCupon,
    porAntiguedad.map((c) => ({ clave: c.id, nombre: c.codigo })),
  );

  const indice = new Map(semanas.map((s, i) => [s.inicio, i]));
  for (const { idCupon, lunes } of aprobadosEnVentana) {
    const semana = semanas[indice.get(lunes) ?? -1];
    if (!semana) continue;
    const clave = nombradas.has(idCupon) ? idCupon : OTROS;
    semana.porSerie[clave] = (semana.porSerie[clave] ?? 0) + 1;
    semana.total += 1;
  }

  return { semanas, series, aplicaron, pagosConCupon, pagosTotales, recaudadoCop };
}

/**
 * Uso de los cupones según los intentos de pago. Solo tiene sentido con el
 * cobro encendido: la página no la llama mientras `PRECIOS_HABILITADOS` sea
 * falso.
 */
export async function getUsoCupones(cupones: { id: string; codigo: string; creadoEn: string }[]): Promise<UsoCupones> {
  const supabase = await createClient();
  const desde = `${sumarDias(diaEnColombia(new Date()), -(DIAS_CIFRAS - 1))}T00:00:00-05:00`;

  // ponytail: trae todos los intentos con cupón para contar "lo aplicaron" de
  // siempre; con decenas de miles de intentos, pasar el conteo a una vista
  // o RPC que agrupe en la base.
  const [{ data, error }, { count, error: errorTotales }] = await Promise.all([
    supabase
      .from("intentos_pago")
      .select("id_cupon, estado, monto_centavos, moneda, actualizado_en")
      .not("id_cupon", "is", null),
    supabase
      .from("intentos_pago")
      .select("id", { count: "exact", head: true })
      .eq("estado", "APROBADO")
      .gte("actualizado_en", desde),
  ]);
  lanzarSiFalla(error, "cupones:intentos_pago");
  lanzarSiFalla(errorTotales, "cupones:intentos_pago_totales");

  const intentos = (data ?? []).map((fila) => ({
    idCupon: fila.id_cupon as string,
    estado: fila.estado as string,
    // BigInt en el esquema: PostgREST lo puede entregar como string.
    montoCentavos: Number(fila.monto_centavos),
    moneda: fila.moneda as string,
    actualizadoEn: fila.actualizado_en as string,
  }));
  return resumirUsoCupones(intentos, cupones, count ?? 0);
}
