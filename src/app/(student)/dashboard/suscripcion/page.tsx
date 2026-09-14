import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { createClient } from "@/lib/supabase/server";
import { SuscripcionContent } from "@/components/dashboard/SuscripcionContent";
import { EstadoPagoBanner, type EstadoIntento } from "@/components/dashboard/EstadoPagoBanner";

export const metadata: Metadata = { title: "U.V.A. — Suscripción" };

export default async function SuscripcionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getPerfilActual();
  const suscripcion = await getSuscripcionActual(user!.id);

  // `?ref=` lo pone `iniciarCheckout` en la url de retorno que recibe la
  // pasarela. Solo está presente cuando el estudiante acaba de volver de
  // pagar; en una visita normal a esta pantalla no hay nada que consultar.
  const params = await searchParams;
  const referencia = typeof params.ref === "string" ? params.ref : null;

  let estadoPago: EstadoIntento | null = null;
  if (referencia) {
    const supabase = await createClient();
    // Cliente de RLS, no Service Role: `intentos_pago_select_propio`
    // (supabase/sql/100) ya limita la lectura a los intentos del usuario, así
    // que una referencia ajena pegada en la url no devuelve nada.
    const { data: intento } = await supabase
      .from("intentos_pago")
      .select("estado")
      .eq("referencia", referencia)
      .maybeSingle();

    if (intento) estadoPago = intento.estado as EstadoIntento;
  }

  return (
    <>
      {estadoPago && <EstadoPagoBanner estado={estadoPago} />}
      <SuscripcionContent suscripcion={suscripcion} />
    </>
  );
}
