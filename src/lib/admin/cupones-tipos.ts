/**
 * Constantes, tipos y validaciones de Cupones — separados de
 * `src/actions/admin/cupones.ts` por el mismo motivo que `planes-tipos.ts`:
 * ese archivo lleva "use server" y un módulo así solo puede exportar
 * funciones async. Cualquier otro export (un array, un tipo, una función
 * pura) llega al cliente como una referencia RPC vacía en vez del valor real.
 */

import { validarCupon } from "@/lib/pagos/descuento";

export const TIPOS_DESCUENTO = ["PORCENTAJE", "MONTO_FIJO"] as const;
export type TipoDescuentoCupon = (typeof TIPOS_DESCUENTO)[number];

export const ETIQUETA_TIPO: Record<TipoDescuentoCupon, string> = {
  PORCENTAJE: "Porcentaje",
  MONTO_FIJO: "Monto fijo",
};

/** Tope de la columna `codigo`, que es `text` sin longitud en la base. Es un
 *  freno a la equivocación, no una regla de negocio: un cupón se dicta y se
 *  teclea, así que más de 40 caracteres ya no sirve para lo que existe. */
export const MAX_LARGO_CODIGO = 40;

export type CuponInput = {
  codigo: string;
  tipoDescuento: TipoDescuentoCupon;
  /**
   * En la unidad que escribe el administrador: porcentaje entero (1-100)
   * cuando el tipo es PORCENTAJE, y PESOS —no centavos— cuando es
   * MONTO_FIJO. La conversión a centavos la hace el Server Action, igual que
   * con `PlanInput.precio`: los centavos son un detalle de almacenamiento y
   * no tienen por qué pedírsele a quien carga una campaña.
   */
  valor: number;
  fechaVencimiento: string;
  /** null = sin tope de usos. A diferencia de `codigos_invitacion`, en
   *  `cupones` la columna SÍ es nullable (ver schema.prisma). */
  limiteUsos: number | null;
};

/** Lo que se puede cambiar de un cupón que ya existe. `codigo` y
 *  `tipoDescuento` no están: ver el encabezado de `actualizarCupon`. */
export type CuponEdicion = Omit<CuponInput, "codigo" | "tipoDescuento">;

/**
 * Normaliza el código a como se va a comparar al canjearlo.
 *
 * MAYÚSCULAS no es cosmético, es lo que hace que el cupón funcione. El campo
 * del checkout fuerza mayúsculas mientras el estudiante escribe
 * (`CheckoutContent`), y `buscarCuponVigente` compara con `.eq("codigo", …)`,
 * que en Postgres distingue mayúsculas de minúsculas. Un cupón guardado como
 * "Lanzamiento" no se puede canjear NUNCA: el estudiante siempre manda
 * "LANZAMIENTO" y la consulta devuelve cero filas, que el checkout le muestra
 * como "Ese cupón no existe". Guardarlo ya normalizado cierra esa grieta
 * desde el único lado que la puede cerrar de verdad.
 */
export function normalizarCodigoCupon(entrada: string): string {
  return entrada.trim().toUpperCase().replace(/\s+/g, "");
}

/** Valida el código YA normalizado. */
export function validarCodigoCuponAdmin(codigo: string): string | null {
  if (!codigo) return "El código es obligatorio.";
  if (codigo.length > MAX_LARGO_CODIGO) {
    return `El código no puede pasar de ${MAX_LARGO_CODIGO} caracteres.`;
  }
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(codigo)) {
    return "El código solo admite letras, números, guion y guion bajo, y debe empezar por letra o número.";
  }
  return null;
}

/**
 * Valida el valor del descuento en la unidad del administrador.
 *
 * El tope de 100 solo aplica a PORCENTAJE — lo mismo que hace el CHECK
 * `cupones_porcentaje_max_100` (supabase/sql/071). Se comprueba aquí para que
 * el error salga redactado en vez de llegar como un fallo genérico de insert.
 */
export function validarValorCupon(tipo: TipoDescuentoCupon, valor: number): string | null {
  if (!Number.isFinite(valor) || valor <= 0) {
    return "El valor del descuento debe ser mayor que cero.";
  }
  if (tipo === "PORCENTAJE") {
    if (!Number.isInteger(valor) || valor > 100) {
      return "El porcentaje debe ser un número entero entre 1 y 100.";
    }
  }
  return null;
}

/** Valida el límite de usos. `null` es válido: significa sin tope. */
export function validarLimiteUsos(limiteUsos: number | null): string | null {
  if (limiteUsos === null) return null;
  if (!Number.isInteger(limiteUsos) || limiteUsos < 1) {
    return "El límite de usos debe ser un número entero mayor que cero, o dejarse sin tope.";
  }
  return null;
}

export function validarFechaVencimientoCupon(fechaVencimiento: string): string | null {
  const vence = new Date(fechaVencimiento);
  if (Number.isNaN(vence.getTime())) return "La fecha de vencimiento no es válida.";
  if (vence.getTime() <= Date.now()) return "La fecha de vencimiento debe ser futura.";
  return null;
}

export type EstadoCupon = "ACTIVO" | "VENCIDO" | "AGOTADO";

/**
 * Estado real de un cupón.
 *
 * Delega en `validarCupon`, que es LA MISMA función que decide si el cupón se
 * aplica en el checkout (`buscarCuponVigente`). No es reutilización por
 * ahorrar líneas: si el panel dedujera el estado por su cuenta podría decir
 * "Activo" sobre un cupón que el estudiante ve rechazado, y el administrador
 * no tendría forma de saber cuál de las dos pantallas miente.
 *
 * Tampoco se guarda en una columna, por el mismo motivo que `estadoCodigo`
 * (src/lib/codigoInvitacion.ts): un estado que depende del reloj necesitaría
 * un cron que lo mantuviera al día.
 *
 * Ojo — no hay estado "INACTIVO" porque `cupones` no tiene columna `activo`.
 * Un cupón se apaga venciéndolo (`vencerCuponAhora`).
 */
export function estadoCupon(cupon: {
  fechaVencimiento: string;
  limiteUsos: number | null;
  vecesUsado: number;
}): EstadoCupon {
  const motivo = validarCupon({
    fecha_vencimiento: cupon.fechaVencimiento,
    limite_usos: cupon.limiteUsos,
    veces_usado: cupon.vecesUsado,
  });

  if (motivo === "vencido") return "VENCIDO";
  if (motivo === "agotado") return "AGOTADO";
  return "ACTIVO";
}
