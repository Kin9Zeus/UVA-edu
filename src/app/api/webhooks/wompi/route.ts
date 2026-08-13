import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // TODO: verificar la firma comparando el checksum en payload.signature
  // contra el hash calculado con WOMPI_PRV_KEY, según el algoritmo de
  // Wompi Events. Responder 400 si la verificación falla.
  console.log("[webhook:wompi] evento recibido", { event: payload?.event });

  // TODO: antes de procesar cualquier lógica de negocio, registrar el id
  // del evento como id_evento_externo en la tabla eventos_webhook
  // (createAdminClient() de "@/lib/supabase/admin"). Si ya existe un
  // registro con procesado = true, responder 200 OK sin reprocesar
  // (idempotencia — functional-spec.md §5.2, technical-spec.md §7).

  // TODO: aplicar la lógica de negocio según payload.event (activar
  // suscripción, registrar Pago, etc.) y marcar procesado = true.

  return NextResponse.json({ received: true });
}
