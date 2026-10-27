/**
 * Constantes y tipos de Planes, separados de src/actions/admin/planes.ts a
 * propósito: ese archivo lleva "use server", y un módulo "use server" en
 * Next.js solo puede exportar funciones async — cualquier export que no lo
 * sea (un array, un tipo) se reemplaza por una referencia RPC vacía al
 * llegar al cliente en vez del valor real, y `MONEDAS_PLAN.map` truena en
 * runtime con "is not a function". Mismo motivo por el que
 * comunidad-tipos.ts vive separado de comunidad.ts.
 */

import type { PlanRow } from "@/lib/planes";

export const MONEDAS_PLAN = ["COP", "USD"] as const;
export const NIVELES_ACCESO_PLAN = ["TOTAL", "BASICO"] as const;

export type PlanInput = {
  nombre: string;
  descripcion: string;
  /** En la unidad completa de la moneda (pesos, dólares) — nunca centavos:
   * eso es un detalle de almacenamiento que no tiene por qué pedírsele al
   * admin. Se multiplica por 100 antes de guardar. */
  precio: number;
  moneda: (typeof MONEDAS_PLAN)[number];
  duracionDias: number;
  nivelAcceso: (typeof NIVELES_ACCESO_PLAN)[number];
  orden: number;
};

/** El plan con la forma que usa la página de precios, para calcular igual que ella. */
export function comoPlanPublico(plan: {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioCentavos: number;
  moneda: string;
  duracionDias: number;
  nivelAcceso: string | null;
}): PlanRow {
  return {
    id: plan.id,
    nombre: plan.nombre,
    descripcion: plan.descripcion,
    precio_centavos: plan.precioCentavos,
    moneda: plan.moneda,
    duracion_dias: plan.duracionDias,
    nivel_acceso: plan.nivelAcceso,
  };
}

/** El plan más corto de los que se venden: contra él calcula el ahorro la página de precios (home/Pricing.tsx). */
export function referenciaDe(planes: PlanRow[]): PlanRow | null {
  return planes.reduce<PlanRow | null>((menor, plan) => (!menor || plan.duracion_dias < menor.duracion_dias ? plan : menor), null);
}

/** Meses que cubre un plan, para "equivale a X al mes": 30 días es 1, 90 son 3, 365 son 12. */
export function mesesDe(duracionDias: number): number {
  return Math.max(1, Math.round((duracionDias * 12) / 365));
}

/** Una membresía pagada que vence en estos días o menos sale como aviso. */
export const DIAS_AVISO_VENCE = 7;
