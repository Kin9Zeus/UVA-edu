"use server";

import { createClient } from "@/lib/supabase/server";
import { calcularDesglose, validarCupon, MENSAJE_CUPON_INVALIDO } from "@/lib/pagos/descuento";
import { formatearPrecio } from "@/lib/planes";

export type ValidarCuponResult =
  | { ok: true; desglose: DesgloseVisible }
  | { ok: false; error: string };

/** El desglose ya formateado, para que el componente no vuelva a formatear
 *  y no pueda mostrar una cifra distinta a la que se va a cobrar. */
export type DesgloseVisible = {
  subtotal: string;
  descuento: string;
  total: string;
  /** El total en centavos, para comparar contra lo que se firme después. */
  totalCentavos: number;
};

/**
 * Valida un código de cupón contra un plan y devuelve el desglose que se le
 * muestra al estudiante ANTES de mandarlo a pagar.
 *
 * Comparte `calcularDesglose` con `iniciarCheckout` a propósito: el total que
 * se anuncia aquí y el que se firma allá salen de la misma función. Si se
 * calcularan por separado podrían separarse con cualquier cambio y el
 * estudiante vería un precio distinto al que se le cobra.
 *
 * Esta acción NO reserva ni consume el cupón — `veces_usado` solo se
 * incrementa cuando el pago se aprueba, dentro de `aplicar_pago_wompi`
 * (supabase/sql/101). Un estudiante que valida un código y abandona el
 * checkout no le gasta un uso a nadie.
 *
 * PENDIENTE (agrupado con el resto del SQL): rate limit por usuario, al estilo
 * de `verificar_limite_canjear_codigo` (supabase/sql/023, hallazgo P2-2 de
 * AUDIT-2026-09-04). Es un endpoint autenticado que permite probar códigos a
 * ciegas. El riesgo es menor que el de los códigos de invitación —un cupón da
 * descuento, no acceso gratis— pero es el mismo patrón y merece la misma
 * guarda. No se hace ahora para no sumar otra corrida de `npm run db:rls`
 * mientras otra rama está trabajando sobre la misma base.
 */
export async function validarCodigoCupon(
  idPlan: string,
  codigoCupon: string,
): Promise<ValidarCuponResult> {
  const codigo = codigoCupon.trim();
  if (!codigo) {
    return { ok: false, error: "Escribe un código." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Autenticado: no es un validador público de códigos.
  if (!user) {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const { data: plan } = await supabase
    .from("planes")
    .select("precio_centavos, moneda")
    .eq("id", idPlan)
    .eq("activo", true)
    .maybeSingle();

  if (!plan) {
    return { ok: false, error: "Ese plan ya no está disponible." };
  }

  const { data: cupon } = await supabase
    .from("cupones")
    .select("tipo_descuento, valor, fecha_vencimiento, limite_usos, veces_usado")
    .eq("codigo", codigo)
    .maybeSingle();

  if (!cupon) {
    return { ok: false, error: "Ese cupón no existe." };
  }

  const motivo = validarCupon(cupon);
  if (motivo) {
    return { ok: false, error: MENSAJE_CUPON_INVALIDO[motivo] };
  }

  const desglose = calcularDesglose(Number(plan.precio_centavos), {
    tipo_descuento: cupon.tipo_descuento,
    valor: Number(cupon.valor),
  });

  if (desglose.totalCentavos <= 0) {
    return {
      ok: false,
      error: "Ese cupón cubre el plan completo. Pídenos un código de invitación.",
    };
  }

  return {
    ok: true,
    desglose: {
      subtotal: formatearPrecio(desglose.subtotalCentavos, plan.moneda),
      descuento: formatearPrecio(desglose.descuentoCentavos, plan.moneda),
      total: formatearPrecio(desglose.totalCentavos, plan.moneda),
      totalCentavos: desglose.totalCentavos,
    },
  };
}
