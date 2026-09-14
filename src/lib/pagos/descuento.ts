/**
 * Aplicación de un cupón a un precio. Funciones PURAS, sin base de datos.
 *
 * Puras a propósito, mismo criterio que `mensajeMembresiaYaVigente`
 * (src/lib/admin/membresiaManual.ts): el cálculo del total es lo que se firma
 * y se cobra, así que tiene que poder probarse exhaustivamente sin montar un
 * entorno. Quien consulta la base es el Server Action; aquí solo se calcula.
 *
 * El total que sale de aquí se usa DOS veces y tienen que ser el mismo:
 *   1. el que se le muestra al estudiante antes de mandarlo a pagar, y
 *   2. el que entra en el hash de integridad de Wompi.
 * Si se calcularan por separado podrían contradecirse, y Wompi rechazaría la
 * transacción por firma inválida sin que nadie entienda por qué.
 */

/** Espejo de `TipoDescuento` en schema.prisma. */
export type TipoDescuento = "PORCENTAJE" | "MONTO_FIJO";

export type CuponAplicable = {
  tipo_descuento: TipoDescuento;
  /**
   * OJO — la unidad DEPENDE de `tipo_descuento`, igual que en la columna
   * `cupones.valor`: centavos cuando es MONTO_FIJO, y un porcentaje entero
   * (0-100) cuando es PORCENTAJE. Una sola columna para dos unidades; por eso
   * esta función ramifica en vez de multiplicar a ciegas.
   */
  valor: number;
};

export type Desglose = {
  /** Precio de lista del plan, en centavos. */
  subtotalCentavos: number;
  /** Lo que se descuenta, en centavos. Nunca mayor que el subtotal. */
  descuentoCentavos: number;
  /** Lo que se cobra de verdad. Es lo que se firma. */
  totalCentavos: number;
};

/**
 * Calcula el desglose de un cobro.
 *
 * `cupon` nulo = precio de lista, sin descuento.
 *
 * Tres decisiones que no son obvias:
 *
 *   - **El descuento nunca supera el subtotal.** Un cupón de $100.000 sobre un
 *     plan de $50.000 descuenta $50.000, no deja el total en -$50.000. Un
 *     monto negativo viajaría a Wompi y sería rechazado, pero antes habría
 *     pasado por `intentos_pago`, cuyo CHECK `monto_centavos > 0` lo frena
 *     (supabase/sql/100). Es la misma regla escrita en los dos sitios a
 *     propósito: aquí para que el estudiante vea un número correcto, allá para
 *     que un error de cálculo no llegue nunca a la base.
 *
 *   - **El porcentaje se redondea a favor del estudiante** (`Math.round`
 *     sobre el descuento, no sobre el total): con un 33% sobre $89.900 la
 *     diferencia es de un peso, pero es el peso que el estudiante ve
 *     anunciado.
 *
 *   - **Un porcentaje fuera de 0-100 se acota** en vez de lanzar. Un cupón mal
 *     cargado por el admin no debe tumbar la pantalla de planes; debe cobrar
 *     lo correcto y dejar que el cupón se corrija después.
 */
export function calcularDesglose(
  subtotalCentavos: number,
  cupon: CuponAplicable | null,
): Desglose {
  if (!cupon) {
    return {
      subtotalCentavos,
      descuentoCentavos: 0,
      totalCentavos: subtotalCentavos,
    };
  }

  const bruto =
    cupon.tipo_descuento === "PORCENTAJE"
      ? Math.round((subtotalCentavos * acotarPorcentaje(cupon.valor)) / 100)
      : cupon.valor;

  // Nunca negativo (un cupón con valor negativo SUBIRÍA el precio) ni mayor
  // que el subtotal.
  const descuentoCentavos = Math.min(Math.max(bruto, 0), subtotalCentavos);

  return {
    subtotalCentavos,
    descuentoCentavos,
    totalCentavos: subtotalCentavos - descuentoCentavos,
  };
}

function acotarPorcentaje(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.min(Math.max(valor, 0), 100);
}

/**
 * ¿Este cupón se puede usar ahora mismo?
 *
 * Pura también: recibe la fila tal como está en la base y el instante contra
 * el que comparar. El Server Action la consulta, esta función decide.
 *
 * `limite_usos` es NOT NULL con CHECK >= 1 desde la migración
 * 20260827000000 en `codigos_invitacion`; en `cupones` sigue siendo nullable
 * (ver schema.prisma), así que aquí null significa "sin tope".
 */
export type MotivoCuponInvalido = "vencido" | "agotado";

export function validarCupon(
  cupon: { fecha_vencimiento: string | Date; limite_usos: number | null; veces_usado: number },
  ahora: Date = new Date(),
): MotivoCuponInvalido | null {
  const vence = cupon.fecha_vencimiento instanceof Date
    ? cupon.fecha_vencimiento
    : new Date(cupon.fecha_vencimiento);

  if (vence.getTime() < ahora.getTime()) return "vencido";
  if (cupon.limite_usos !== null && cupon.veces_usado >= cupon.limite_usos) return "agotado";
  return null;
}

/** Lo que se le dice al estudiante. El mensaje ES el arreglo: "cupón inválido"
 *  a secas no le dice si escribió mal el código o si llegó tarde. */
export const MENSAJE_CUPON_INVALIDO: Record<MotivoCuponInvalido, string> = {
  vencido: "Ese cupón ya venció.",
  agotado: "Ese cupón ya alcanzó su límite de usos.",
};
