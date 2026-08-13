import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  // TODO: verificar la firma con
  // stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  // (cliente en "@/lib/stripe/client"). Responder 400 si la verificación falla.
  console.log("[webhook:stripe] evento recibido", { signature, bytes: payload.length });

  // TODO: antes de procesar cualquier lógica de negocio, registrar el id
  // del evento (event.id) como id_evento_externo en la tabla
  // eventos_webhook (createAdminClient() de "@/lib/supabase/admin"). Si ya
  // existe un registro con procesado = true, responder 200 OK sin
  // reprocesar (idempotencia — functional-spec.md §5.2, technical-spec.md §7).

  // TODO: aplicar la lógica de negocio según event.type (activar
  // suscripción, registrar Pago, etc.) y marcar procesado = true.

  return NextResponse.json({ received: true });
}
