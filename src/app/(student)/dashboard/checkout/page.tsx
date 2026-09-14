import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { buscarMembresiaVigente } from "@/lib/admin/membresiaManual";
import { CheckoutContent, type PlanCheckout } from "@/components/dashboard/CheckoutContent";
import { vigenciaAlComprar, type PlanRow } from "@/lib/planes";
import { esUuid, slugificar } from "@/lib/slug";
import { logError } from "@/lib/log";

export const metadata: Metadata = { title: "U.V.A. — Confirmar suscripción" };

/**
 * Paso de confirmación entre elegir plan y pagar.
 *
 * Por qué existe una pantalla propia y no un formulario dentro de la tarjeta
 * del plan: el cupón no es una propiedad del plan, es una propiedad de la
 * compra. Metido en la tarjeta se repetía una vez por plan —tres campos para
 * un solo código—, rompía la altura pareja de la rejilla al abrirse y dejaba
 * el descuento debajo del botón mientras el precio de lista seguía intacto
 * justo encima, o sea dos precios distintos en la misma tarjeta.
 *
 * Aquí hay un solo cupón, un solo total, y el plan se puede cambiar sin
 * perderlo.
 *
 * La fecha de vencimiento se calcula EN EL SERVIDOR y viaja ya formateada:
 * si se calculara en el componente cliente a partir de `Date.now()`, el
 * render del servidor y el del navegador podrían caer en días distintos y
 * React reportaría un desajuste de hidratación.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getPerfilActual();
  const supabase = await createClient();

  // Mismo guard que `iniciarCheckout`, pero aquí sirve para no mostrarle una
  // pantalla de cobro a alguien que ya tiene acceso: el Server Action lo
  // rechazaría después, y enterarse al final es peor que no entrar.
  const vigente = await buscarMembresiaVigente(supabase, user!.id);
  if (vigente) {
    redirect("/dashboard/suscripcion");
  }

  const { data, error } = await supabase
    .from("planes")
    .select("id, nombre, descripcion, precio_centavos, moneda, duracion_dias, nivel_acceso")
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    logError("dashboard/checkout", "No se pudieron cargar los planes", error);
  }

  const planes = (data ?? []) as PlanRow[];
  if (planes.length === 0) {
    redirect("/dashboard/planes");
  }

  const planesConVigencia: PlanCheckout[] = planes.map((plan) => ({
    ...plan,
    vigenteHasta: vigenciaAlComprar(plan.duracion_dias),
  }));

  // El plan de la url manda; si no viene, no existe o ya no está activo, se
  // preselecciona el de mejor precio por día — el mismo criterio con el que la
  // pantalla de Planes marca uno como destacado, para que la preselección
  // coincida con lo que el estudiante venía viendo.
  //
  // `?plan=` viaja como SLUG ("anual"), no como el uuid de la fila: ninguna
  // otra url del producto muestra identificadores crudos —todas las rutas
  // dinámicas son `[cursoSlug]`, `[usuarioSlug]`, `[postSlug]`— y esta no
  // tiene por qué ser la excepción. `planes` no tiene columna `slug`, así que
  // se deriva del nombre al vuelo en vez de agregar una columna (y con ella
  // una migración más que revertir) solo para embellecer una url.
  //
  // Se acepta también el uuid, igual que hacen `resolverCategoria` y sus
  // hermanas con los enlaces viejos que siguen circulando.
  const params = await searchParams;
  const pedido = typeof params.plan === "string" ? params.plan : null;

  // Dos planes con nombres que slugifican igual dejarían este `find` en el
  // primero por `orden`. Es determinista y no hace daño: esto solo decide qué
  // radio viene marcado, y el estudiante puede cambiarlo.
  const elegido = pedido
    ? planesConVigencia.find((plan) =>
        esUuid(pedido) ? plan.id === pedido : slugificar(plan.nombre, "plan") === pedido,
      )
    : undefined;

  const mejorPorDia = planesConVigencia.reduce((mejor, plan) =>
    plan.precio_centavos / plan.duracion_dias < mejor.precio_centavos / mejor.duracion_dias
      ? plan
      : mejor,
  );

  return (
    <CheckoutContent
      planes={planesConVigencia}
      idPlanInicial={(elegido ?? mejorPorDia).id}
    />
  );
}
