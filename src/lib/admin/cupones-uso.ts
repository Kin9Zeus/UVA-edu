import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { diaEnColombia, sumarDias } from "@/lib/admin/bitacora";

export const CUPONES_SEMANAS = 12;
const DIAS_CIFRAS = 30;
const MAX_SERIES = 4;

export type SerieCupon = { clave: string; nombre: string; color: string };

export type SemanaCupones = {
  /** Lunes de la semana, "YYYY-MM-DD" en hora de Colombia. */
  inicio: string;
  porSerie: Record<string, number>;
  total: number;
};

export type UsoCupones = {
  semanas: SemanaCupones[];
  /** Hasta 4 cupones con nombre y, si hay más, "Otros". */
  series: SerieCupon[];
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

const OTROS = "otros";

function lunesDe(dia: string): string {
  const diaSemana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return sumarDias(dia, -((diaSemana + 6) % 7));
}

/**
 * Agrupa los intentos con cupón en semanas, series y cifras. Pura para poder
 * probarla sin base.
 *
 * Los colores siguen al cupón, no a su puesto: entre los 4 con más usos de la
 * ventana, el más antiguo toma la serie 1. Así un cupón no cambia de color
 * porque otro lo pase en usos esta semana.
 */
export function resumirUsoCupones(
  intentos: IntentoConCupon[],
  cupones: { id: string; codigo: string; creadoEn: string }[],
  pagosTotales: number,
  ahora: Date = new Date(),
): UsoCupones {
  const hoy = diaEnColombia(ahora);
  const primerLunes = sumarDias(lunesDe(hoy), -7 * (CUPONES_SEMANAS - 1));
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
  const porId = new Map(cupones.map((c) => [c.id, c]));
  const conNombre = [...usosPorCupon.entries()]
    .filter(([id]) => porId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES)
    .map(([id]) => porId.get(id)!)
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  const nombrados = new Set(conNombre.map((c) => c.id));
  const series: SerieCupon[] = conNombre.map((c, i) => ({ clave: c.id, nombre: c.codigo, color: `var(--uva-serie-${i + 1})` }));
  if (aprobadosEnVentana.some((a) => !nombrados.has(a.idCupon))) {
    series.push({ clave: OTROS, nombre: "Otros", color: "var(--uva-serie-5)" });
  }

  const semanas: SemanaCupones[] = Array.from({ length: CUPONES_SEMANAS }, (_, i) => ({
    inicio: sumarDias(primerLunes, 7 * i),
    porSerie: {},
    total: 0,
  }));
  const indice = new Map(semanas.map((s, i) => [s.inicio, i]));
  for (const { idCupon, lunes } of aprobadosEnVentana) {
    const semana = semanas[indice.get(lunes) ?? -1];
    if (!semana) continue;
    const clave = nombrados.has(idCupon) ? idCupon : OTROS;
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
