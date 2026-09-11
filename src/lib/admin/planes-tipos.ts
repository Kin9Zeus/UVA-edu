/**
 * Constantes y tipos de Planes, separados de src/actions/admin/planes.ts a
 * propósito: ese archivo lleva "use server", y un módulo "use server" en
 * Next.js solo puede exportar funciones async — cualquier export que no lo
 * sea (un array, un tipo) se reemplaza por una referencia RPC vacía al
 * llegar al cliente en vez del valor real, y `MONEDAS_PLAN.map` truena en
 * runtime con "is not a function". Mismo motivo por el que
 * comunidad-tipos.ts vive separado de comunidad.ts.
 */

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
