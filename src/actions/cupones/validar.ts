"use server";

import { createClient } from "@/lib/supabase/server";
import { calcularDesglose } from "@/lib/pagos/descuento";
import { buscarCuponVigente } from "@/lib/pagos/cupones";
import { formatearPrecio } from "@/lib/planes";

export type ValidarCuponResult =
  | { ok: true; desglose: DesgloseVisible }
  | {
      ok: false;
      error: string;
      /**
       * Solo presente cuando el rechazo vino del rate limit de
       * `buscarCuponVigente` (P2-1, supabase/sql/106). Ver `BusquedaCupon`.
       */
      segundosEspera?: number;
    };

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
 * El cupón se busca con `buscarCuponVigente`, que consulta con Service Role:
 * `cupones` tiene RLS de solo-administrador y con el cliente del estudiante
 * la tabla se ve vacía. Ahí vive también el rate limit por usuario (P2-1),
 * no aquí: es el punto único que comparten esta acción e `iniciarCheckout`.
 * Ver el encabezado de src/lib/pagos/cupones.ts.
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

  const busqueda = await buscarCuponVigente(codigo, user.id);
  if (!busqueda.ok) {
    return { ok: false, error: busqueda.error, segundosEspera: busqueda.segundosEspera };
  }

  const desglose = calcularDesglose(Number(plan.precio_centavos), busqueda.cupon);

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
