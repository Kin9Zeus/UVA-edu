"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import type { AdminActionResult } from "@/actions/admin/categorias";
import {
  normalizarCodigoCupon,
  validarCodigoCuponAdmin,
  validarFechaVencimientoCupon,
  validarLimiteUsos,
  validarValorCupon,
  type CuponEdicion,
  type CuponInput,
  type TipoDescuentoCupon,
} from "@/lib/admin/cupones-tipos";

/**
 * Pasa el valor de la unidad del administrador a la de la columna.
 *
 * `cupones.valor` guarda dos unidades distintas en la misma columna según
 * `tipo_descuento` (lo advierte el propio schema.prisma): centavos para
 * MONTO_FIJO, porcentaje entero para PORCENTAJE. Esta es la única función que
 * hace la conversión, para que no se repita mal en crear y en actualizar.
 */
function aValorDeColumna(tipo: TipoDescuentoCupon, valor: number): number {
  return tipo === "PORCENTAJE" ? valor : Math.round(valor * 100);
}

/** El final del día elegido, como en los códigos de invitación: si no, un
 *  cupón "válido hasta el 30" vencería a las 00:00 de ese día — un día antes
 *  de lo que entendió quien lo cargó. */
function finDelDia(fecha: string): string {
  return `${fecha}T23:59:59`;
}

export async function crearCupon(input: CuponInput): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const codigo = normalizarCodigoCupon(input.codigo);
  const fechaVencimiento = finDelDia(input.fechaVencimiento);

  const invalido =
    validarCodigoCuponAdmin(codigo) ??
    validarValorCupon(input.tipoDescuento, input.valor) ??
    validarFechaVencimientoCupon(fechaVencimiento) ??
    validarLimiteUsos(input.limiteUsos);
  if (invalido) return { error: invalido };

  const { data, error } = await admin.supabase
    .from("cupones")
    .insert({
      codigo,
      tipo_descuento: input.tipoDescuento,
      valor: aValorDeColumna(input.tipoDescuento, input.valor),
      fecha_vencimiento: new Date(fechaVencimiento).toISOString(),
      limite_usos: input.limiteUsos,
    })
    .select("id")
    .single();

  // `codigo` es UNIQUE en el esquema: el choque es el error esperable aquí y
  // merece su propio mensaje, no un "no pudimos crear" que deje al
  // administrador buscando qué escribió mal.
  if (error) {
    return {
      error:
        error.code === "23505"
          ? `Ya existe un cupón con el código ${codigo}.`
          : "No pudimos crear el cupón.",
    };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Creó un cupón",
    entidadAfectada: "cupones",
    idEntidadAfectada: data.id,
    detalles: codigo,
  });

  revalidatePath("/admin/cupones");
  return { success: true };
}

/**
 * Edita un cupón existente.
 *
 * NO se puede cambiar `codigo` ni `tipo_descuento`, y son dos negativas
 * distintas:
 *
 *   - **El código** es la identidad del cupón y ya se repartió. Cambiarlo no
 *     renombra nada: deja muerto el que está en la pieza publicitaria y crea
 *     uno nuevo que nadie tiene.
 *
 *   - **El tipo** decide cómo se lee `valor`. Pasar de PORCENTAJE a
 *     MONTO_FIJO sin tocar el número convierte un 20% en veinte centavos, y al
 *     revés convierte $20.000 en un descuento del 2.000.000% que el CHECK de
 *     la base rechaza. Una sola columna con dos unidades no admite que se
 *     cambie la unidad y se conserve el número.
 *
 * El valor SÍ se puede cambiar, incluso con canjes ya hechos: subir un 20% a
 * un 25% a mitad de campaña es legítimo y no reescribe nada hacia atrás — lo
 * que se cobró de verdad vive en `pagos`, no aquí.
 */
export async function actualizarCupon(
  id: string,
  input: CuponEdicion,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const fechaVencimiento = finDelDia(input.fechaVencimiento);

  const invalido =
    validarFechaVencimientoCupon(fechaVencimiento) ?? validarLimiteUsos(input.limiteUsos);
  if (invalido) return { error: invalido };

  const { data: actual } = await admin.supabase
    .from("cupones")
    .select("codigo, tipo_descuento, veces_usado")
    .eq("id", id)
    .maybeSingle();

  if (!actual) return { error: "Ese cupón ya no existe." };

  // El tipo se lee de la base, no del formulario: es lo que decide la unidad
  // de `valor`, y tomarlo del cliente permitiría reinterpretar la cifra.
  const tipo = actual.tipo_descuento as TipoDescuentoCupon;
  const valorInvalido = validarValorCupon(tipo, input.valor);
  if (valorInvalido) return { error: valorInvalido };

  const vecesUsado = actual.veces_usado as number;

  // Mismo criterio que `actualizarCodigoInvitacion`: bajar el tope por debajo
  // de los canjes ya hechos no invalida nada retroactivamente, pero deja el
  // cupón agotado y con el contador por encima del límite. Además el CHECK
  // `cupones_usos_dentro_del_limite` (supabase/sql/071) lo rechazaría con un
  // error crudo.
  if (input.limiteUsos !== null && input.limiteUsos < vecesUsado) {
    return {
      error: `Ese cupón ya se usó ${vecesUsado} vez/veces: el límite no puede ser menor.`,
    };
  }

  const { error } = await admin.supabase
    .from("cupones")
    .update({
      valor: aValorDeColumna(tipo, input.valor),
      fecha_vencimiento: new Date(fechaVencimiento).toISOString(),
      limite_usos: input.limiteUsos,
    })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el cupón." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Editó un cupón",
    entidadAfectada: "cupones",
    idEntidadAfectada: id,
    detalles: actual.codigo as string,
  });

  revalidatePath("/admin/cupones");
  return { success: true };
}

/**
 * Apaga un cupón adelantando su vencimiento a este instante.
 *
 * Es el sustituto del interruptor que tienen Planes y Códigos: `cupones` no
 * tiene columna `activo`, así que vencer es la única forma de retirarlo sin
 * borrarlo. Y sí retira: `validarCupon` compara la fecha contra el reloj en
 * cada canje, así que el cupón deja de aplicarse en el intento siguiente.
 *
 * Es reversible — se vuelve a editar con una fecha futura — y no toca a nadie
 * que ya lo haya usado: los descuentos ya cobrados están en `pagos`, y las
 * suscripciones que otorgó siguen vivas.
 */
export async function vencerCuponAhora(id: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { data: cupon } = await admin.supabase
    .from("cupones")
    .select("codigo")
    .eq("id", id)
    .maybeSingle();

  if (!cupon) return { error: "Ese cupón ya no existe." };

  const { error } = await admin.supabase
    .from("cupones")
    .update({ fecha_vencimiento: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos vencer el cupón." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Venció un cupón antes de tiempo",
    entidadAfectada: "cupones",
    idEntidadAfectada: id,
    detalles: cupon.codigo as string,
  });

  revalidatePath("/admin/cupones");
  return { success: true };
}

/**
 * Elimina un cupón, SOLO si nunca se usó.
 *
 * Las dos referencias a `cupones` son ON DELETE SET NULL
 * (`suscripciones_id_cupon_fkey` e `intentos_pago_id_cupon_fkey`), así que
 * borrar uno ya usado no rompe nada visible: deja en silencio suscripciones y
 * cobros con un descuento aplicado y ningún rastro de por qué. Eso es
 * exactamente lo que después nadie puede reconstruir. Mismo criterio que
 * `eliminarCodigoInvitacion`.
 *
 * Para retirar un cupón ya usado está `vencerCuponAhora`.
 */
export async function eliminarCupon(id: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { data: cupon } = await admin.supabase
    .from("cupones")
    .select("codigo, veces_usado")
    .eq("id", id)
    .maybeSingle();

  if (!cupon) return { error: "Ese cupón ya no existe." };

  if ((cupon.veces_usado as number) > 0) {
    return {
      error:
        "No se puede eliminar un cupón ya usado, porque los cobros que descontó perderían su origen. Véncelo en su lugar.",
    };
  }

  const { error } = await admin.supabase.from("cupones").delete().eq("id", id);
  if (error) return { error: "No pudimos eliminar el cupón." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Eliminó un cupón sin usar",
    entidadAfectada: "cupones",
    idEntidadAfectada: id,
    detalles: cupon.codigo as string,
  });

  revalidatePath("/admin/cupones");
  return { success: true };
}
