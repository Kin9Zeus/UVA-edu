"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarMembresiaVigente } from "@/lib/admin/membresiaManual";
import { calcularDesglose, validarCupon, MENSAJE_CUPON_INVALIDO } from "@/lib/pagos/descuento";
import { generarReferencia, leerConfig, urlCheckout } from "@/lib/pagos/wompi";
import { normalizarMoneda } from "@/lib/pagos/proveedores";
import { simuladorActivo } from "@/lib/pagos/simulador";
import { siteUrl } from "@/lib/site-url";
import { logError } from "@/lib/log";

export type IniciarCheckoutResult = {
  /** Mensaje para el estudiante. Solo presente si algo impidió cobrar. */
  error?: string;
};

/**
 * Arranca el cobro de un plan: calcula el total, lo registra en
 * `intentos_pago` y redirige al Web Checkout de Wompi.
 *
 * No devuelve nada cuando sale bien: `redirect()` de Next lanza una excepción
 * de control que Next intercepta, así que la función no llega a retornar.
 *
 * Qué NO viene del cliente, y por qué importa
 * -------------------------------------------
 * El cliente manda ÚNICAMENTE un id de plan y, opcionalmente, un código de
 * cupón. Todo lo demás —el precio, el descuento, el total y la firma— se
 * resuelve aquí contra la base. Si el monto llegara del formulario, cualquiera
 * podría comprar el plan anual por $1.000 editando el HTML.
 *
 * El id del usuario sale de `auth.getUser()` sobre la sesión real, nunca de un
 * parámetro — mismo criterio que `canjearCodigoInvitacion`.
 */
export async function iniciarCheckout(
  idPlan: string,
  codigoCupon?: string,
): Promise<IniciarCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  // functional-spec.md §134: sin correo confirmado no se puede iniciar
  // checkout. El middleware ya lo bloquea para /dashboard, pero esta acción
  // puede invocarse desde cualquier parte y no debe confiar en eso.
  if (!user.email_confirmed_at) {
    return { error: "Confirma tu correo antes de suscribirte." };
  }

  // Reusa el mismo guard que `otorgarMembresia`: el índice parcial
  // `suscripcion_activa_unica_por_usuario` solo admite una suscripción
  // ACTIVA/PAST_DUE por usuario. Sin esto el estudiante pagaría y el webhook
  // no podría activar nada — habría cobrado sin poder entregar.
  const vigente = await buscarMembresiaVigente(supabase, user.id);
  if (vigente) {
    return { error: "Ya tienes una suscripción activa." };
  }

  const { data: plan, error: errorPlan } = await supabase
    .from("planes")
    .select("id, nombre, precio_centavos, moneda, activo")
    .eq("id", idPlan)
    .eq("activo", true)
    .maybeSingle();

  if (errorPlan || !plan) {
    return { error: "Ese plan ya no está disponible." };
  }

  // `precio_centavos` es BigInt en el esquema y llega como string por PostgREST
  // cuando excede el entero seguro de JS. Number() es correcto aquí: el techo
  // de un plan está muy por debajo de 2^53.
  const subtotal = Number(plan.precio_centavos);

  const moneda = normalizarMoneda(plan.moneda);
  if (!moneda) {
    // Un plan con moneda inválida no se puede cobrar: la firma de integridad
    // la incluye y `intentos_pago` tiene un CHECK sobre ella.
    logError("iniciarCheckout", "plan con moneda inválida", null, {
      area: "pagos",
      idPlan,
      moneda: plan.moneda,
    });
    return { error: "Ese plan no se puede cobrar ahora mismo. Escríbenos." };
  }

  // ---- Cupón (opcional) -------------------------------------------------
  let idCupon: string | null = null;
  let cuponAplicable = null;

  const codigo = codigoCupon?.trim();
  if (codigo) {
    const { data: cupon } = await supabase
      .from("cupones")
      .select("id, tipo_descuento, valor, fecha_vencimiento, limite_usos, veces_usado")
      .eq("codigo", codigo)
      .maybeSingle();

    if (!cupon) {
      return { error: "Ese cupón no existe." };
    }

    const motivo = validarCupon(cupon);
    if (motivo) {
      return { error: MENSAJE_CUPON_INVALIDO[motivo] };
    }

    idCupon = cupon.id;
    cuponAplicable = { tipo_descuento: cupon.tipo_descuento, valor: Number(cupon.valor) };
  }

  // El MISMO cálculo que ve el estudiante en pantalla (lo comparte
  // `validarCodigoCupon`) y el que se firma. Separarlos los dejaría
  // contradecirse y Wompi rechazaría la transacción.
  const { totalCentavos } = calcularDesglose(subtotal, cuponAplicable);

  // Un cupón del 100% deja el total en 0, y Wompi no cobra $0 — además el
  // CHECK `monto_centavos > 0` de intentos_pago lo rechazaría. Un acceso
  // gratuito se otorga por código de invitación o a mano, que son los dos
  // caminos que el producto ya tiene para eso.
  if (totalCentavos <= 0) {
    return {
      error: "Ese cupón cubre el plan completo. Pídenos un código de invitación.",
    };
  }

  // Las credenciales se comprueban ANTES de escribir nada: si faltan, el
  // intento quedaría PENDIENTE para siempre —nunca va a llegar un webhook de
  // una transacción que jamás se creó— y ensuciaría la tabla con basura que
  // alguien tendría que distinguir después de un abandono real.
  //
  // Con el simulador activo no hace falta ninguna credencial de checkout: el
  // pago no sale de la máquina. Ver src/lib/pagos/simulador.ts.
  const simulado = simuladorActivo();
  let config;
  if (!simulado) {
    try {
      config = leerConfig();
    } catch (error) {
      logError("iniciarCheckout", "credenciales de Wompi mal configuradas", error, {
        area: "pagos",
      });
      return { error: "Los pagos no están disponibles ahora mismo. Escríbenos." };
    }
  }

  // ---- Registrar el intento antes de mandar a pagar ----------------------
  // Service Role: `intentos_pago` no tiene política de INSERT para
  // authenticated a propósito (supabase/sql/100), justamente para que el
  // monto no lo pueda fijar el cliente.
  const referencia = generarReferencia();
  const admin = createAdminClient();

  const { error: errorIntento } = await admin.from("intentos_pago").insert({
    referencia,
    id_usuario: user.id,
    id_plan: plan.id,
    id_cupon: idCupon,
    monto_centavos: totalCentavos,
    moneda,
    estado: "PENDIENTE",
  });

  if (errorIntento) {
    logError("iniciarCheckout", "no se pudo registrar el intento", errorIntento, {
      area: "pagos",
      idPlan,
    });
    return { error: "No pudimos iniciar el pago. Intenta de nuevo." };
  }

  // La referencia viaja en la url de retorno para que la pantalla de
  // suscripción sepa qué intento consultar: Wompi devuelve al estudiante
  // normalmente ANTES de entregar el webhook, y sin esto la página le diría
  // "no tienes acceso" a alguien que acaba de pagar.
  //
  // Con el simulador va RELATIVA, y no es un detalle menor: en este repo
  // `NEXT_PUBLIC_SITE_URL` apunta al despliegue de producción incluso en
  // `next dev`, así que una url absoluta sacaría al desarrollador de su
  // localhost y lo dejaría en el servidor real a mitad de una prueba. Wompi
  // sí exige una url absoluta, y por eso la rama real la conserva.
  const rutaRetorno = `/dashboard/suscripcion?ref=${referencia}`;
  const urlRetorno = simulado ? rutaRetorno : `${siteUrl()}${rutaRetorno}`;

  // El destino es lo ÚNICO que cambia entre simulación y producción. Todo lo
  // de arriba —el cálculo, el intento, la referencia— y todo lo que viene
  // después —webhook, firma, conciliación— es idéntico.
  const destino = simulado
    ? `/dev/wompi?${new URLSearchParams({
        ref: referencia,
        monto: String(totalCentavos),
        moneda,
        plan: plan.nombre,
        retorno: urlRetorno,
      })}`
    : urlCheckout(
        {
          referencia,
          montoCentavos: totalCentavos,
          moneda,
          urlRetorno,
          correoCliente: user.email,
        },
        config,
      );

  // `redirect()` funciona lanzando una excepción de control que Next
  // intercepta: nunca debe quedar dentro de un try/catch propio.
  redirect(destino);
}
