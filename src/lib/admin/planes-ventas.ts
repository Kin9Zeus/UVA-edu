import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { diaEnColombia, sumarDias } from "@/lib/admin/bitacora";
import { PROVEEDORES_PASARELA } from "@/lib/pagos/proveedores";
import { elegirSeries, lunesDe, OTROS, semanasRecientes } from "@/lib/admin/semanas";
import type { SemanaGrafica, SerieGrafica } from "@/lib/admin/grafica";
import { DIAS_AVISO_VENCE } from "@/lib/admin/planes-tipos";

const DIAS_CIFRAS = 30;

/** `porSerie` y `total` en centavos de COP; las ventas, en cantidad. */
export type SemanaVentas = SemanaGrafica & { ventasPorSerie: Record<string, number>; ventas: number };

export type VentasDePlan = { vigentes: number; vencen: number; ventas30: number };

export type VentasPlanes = {
  semanas: SemanaVentas[];
  series: SerieGrafica[];
  porPlan: Record<string, VentasDePlan>;
  /** Membresías pagadas con acceso hoy; las otorgadas a mano y las de códigos no cuentan. */
  vigentes: number;
  vencen: number;
  ventas30: number;
  intentos30: number;
  /** Solo pagos en COP: sumar monedas distintas daría una cifra falsa. */
  recaudadoCop: number;
  /** Ventas en otra moneda que la gráfica (en pesos) deja fuera. */
  fueraDeGrafica: number;
};

export type IntentoDePlan = {
  idPlan: string;
  estado: string;
  montoCentavos: number;
  moneda: string;
  /** Para un APROBADO es el momento de la aprobación: es el último UPDATE. */
  actualizadoEn: string;
};

export type MembresiaPagada = { idPlan: string | null; fechaRenovacion: string };

/**
 * Agrupa los intentos de pago y las membresías pagadas en semanas, series y
 * cifras. Pura para poder probarla sin base.
 *
 * La gráfica va en plata y no en cantidad de ventas: una venta del Anual vale
 * diez del Mensual, y contarlas igual escondería eso. Por ser plata, solo
 * entra lo cobrado en pesos.
 */
export function resumirVentasPlanes(
  intentos: IntentoDePlan[],
  membresias: MembresiaPagada[],
  planes: { id: string; nombre: string }[],
  ahora: Date = new Date(),
): VentasPlanes {
  const { semanas: vacias, primerLunes } = semanasRecientes(ahora);
  const desdeCifras = sumarDias(diaEnColombia(ahora), -(DIAS_CIFRAS - 1));
  const porPlan: Record<string, VentasDePlan> = {};
  const de = (idPlan: string) => (porPlan[idPlan] ??= { vigentes: 0, vencen: 0, ventas30: 0 });

  let ventas30 = 0, intentos30 = 0, recaudadoCop = 0, fueraDeGrafica = 0;
  const enGrafica: { idPlan: string; lunes: string; monto: number }[] = [];
  const recaudadoPorPlan = new Map<string, number>();

  for (const intento of intentos) {
    const dia = diaEnColombia(intento.actualizadoEn);
    const enCifras = dia >= desdeCifras;
    if (enCifras) intentos30 += 1;
    if (intento.estado !== "APROBADO") continue;
    if (enCifras) {
      ventas30 += 1;
      de(intento.idPlan).ventas30 += 1;
      if (intento.moneda === "COP") recaudadoCop += intento.montoCentavos;
    }
    if (dia < primerLunes) continue;
    if (intento.moneda !== "COP") {
      fueraDeGrafica += 1;
      continue;
    }
    enGrafica.push({ idPlan: intento.idPlan, lunes: lunesDe(dia), monto: intento.montoCentavos });
    recaudadoPorPlan.set(intento.idPlan, (recaudadoPorPlan.get(intento.idPlan) ?? 0) + intento.montoCentavos);
  }

  const { series, nombradas } = elegirSeries(
    recaudadoPorPlan,
    planes.map((plan) => ({ clave: plan.id, nombre: plan.nombre })),
  );
  const semanas: SemanaVentas[] = vacias.map((semana) => ({ ...semana, ventasPorSerie: {}, ventas: 0 }));
  const indice = new Map(semanas.map((s, i) => [s.inicio, i]));
  for (const { idPlan, lunes, monto } of enGrafica) {
    const semana = semanas[indice.get(lunes) ?? -1];
    if (!semana) continue;
    const clave = nombradas.has(idPlan) ? idPlan : OTROS;
    semana.porSerie[clave] = (semana.porSerie[clave] ?? 0) + monto;
    semana.total += monto;
    semana.ventasPorSerie[clave] = (semana.ventasPorSerie[clave] ?? 0) + 1;
    semana.ventas += 1;
  }

  const limiteAviso = ahora.getTime() + DIAS_AVISO_VENCE * 86_400_000;
  let vencen = 0;
  for (const membresia of membresias) {
    const vencePronto = new Date(membresia.fechaRenovacion).getTime() <= limiteAviso;
    if (vencePronto) vencen += 1;
    if (!membresia.idPlan) continue;
    de(membresia.idPlan).vigentes += 1;
    if (vencePronto) de(membresia.idPlan).vencen += 1;
  }

  return {
    semanas,
    series,
    porPlan,
    vigentes: membresias.length,
    vencen,
    ventas30,
    intentos30,
    recaudadoCop,
    fueraDeGrafica,
  };
}

/**
 * Ventas de los planes según los intentos de pago y las membresías pagadas.
 * Solo tiene sentido con el cobro encendido: la página no la llama mientras
 * `PRECIOS_HABILITADOS` sea falso.
 */
export async function getVentasPlanes(planes: { id: string; nombre: string }[]): Promise<VentasPlanes> {
  const supabase = await createClient();
  const ahora = new Date();
  const { primerLunes } = semanasRecientes(ahora);

  // ponytail: trae los intentos de 12 semanas y todas las membresías pagadas
  // vigentes; con miles de ventas por semana, agrupar en una vista o RPC.
  const [{ data: intentos, error: errorIntentos }, { data: membresias, error: errorMembresias }] = await Promise.all([
    supabase
      .from("intentos_pago")
      .select("id_plan, estado, monto_centavos, moneda, actualizado_en")
      .gte("actualizado_en", `${primerLunes}T00:00:00-05:00`),
    supabase
      .from("suscripciones")
      .select("id_plan, fecha_renovacion")
      .in("estado", ["ACTIVA", "PAST_DUE"])
      .in("proveedor", [...PROVEEDORES_PASARELA])
      .gt("fecha_renovacion", ahora.toISOString()),
  ]);
  lanzarSiFalla(errorIntentos, "planes:intentos_pago");
  lanzarSiFalla(errorMembresias, "planes:suscripciones_pagadas");

  return resumirVentasPlanes(
    (intentos ?? []).map((fila) => ({
      idPlan: fila.id_plan as string,
      estado: fila.estado as string,
      // BigInt en el esquema: PostgREST lo puede entregar como string.
      montoCentavos: Number(fila.monto_centavos),
      moneda: fila.moneda as string,
      actualizadoEn: fila.actualizado_en as string,
    })),
    (membresias ?? []).map((fila) => ({
      idPlan: fila.id_plan as string | null,
      fechaRenovacion: fila.fecha_renovacion as string,
    })),
    planes,
    ahora,
  );
}
