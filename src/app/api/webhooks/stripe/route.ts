import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { marcarProcesado, registrarEvento } from "@/lib/webhooks/eventos";

// La verificación de firma usa ÚNICAMENTE STRIPE_WEBHOOK_SECRET; la API key
// no interviene. No se importa "@/lib/stripe/client" a propósito: ese módulo
// hace `new Stripe(process.env.STRIPE_SECRET_KEY!)` en el ámbito del módulo y
// `new Stripe("")` lanza, así que con la variable vacía la ruta entera
// reventaría al cargarse — y una ruta que no carga no rechaza nada, solo
// devuelve 500 sin registro. El placeholder de abajo permite que el módulo
// cargue en un entorno a medio configurar; el handler igual rechaza todo
// mientras falte el webhook secret.
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_placeholder_la_verificacion_de_firma_no_la_usa",
);

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // 500, nunca 200: un 2xx le dice a Stripe "recibido, no reenvíes" y el
    // evento se pierde para siempre. Con 500 reintenta hasta 3 días, que es
    // tiempo de sobra para configurar la variable.
    console.error("[webhook:stripe] falta STRIPE_WEBHOOK_SECRET; no se procesa nada");
    return NextResponse.json({ error: "webhook no configurado" }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "falta la firma" }, { status: 400 });
  }

  let evento: Stripe.Event;
  try {
    // constructEventAsync (no constructEvent): usa WebCrypto en vez del módulo
    // `crypto` de Node, así que funciona igual si la ruta llegara a correr en
    // el runtime Edge.
    evento = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    console.error("[webhook:stripe] firma inválida:", (error as Error).message);
    return NextResponse.json({ error: "firma inválida" }, { status: 400 });
  }

  const registro = await registrarEvento({
    proveedor: "stripe",
    idEventoExterno: evento.id,
    tipoEvento: evento.type,
    payload: evento,
  });

  if (registro.estado === "duplicado") {
    return NextResponse.json({ received: true, duplicado: true });
  }
  if (registro.estado === "error") {
    console.error("[webhook:stripe] no se pudo registrar el evento:", registro.mensaje);
    return NextResponse.json({ error: "no se pudo registrar el evento" }, { status: 500 });
  }

  // TODO: lógica de negocio por evento.type — checkout.session.completed e
  // invoice.paid activan/renuevan la Suscripción y registran el Pago;
  // customer.subscription.deleted la cancela (functional-spec.md Flujo 06).
  // Está pendiente porque todavía no existe el checkout que crea la sesión de
  // Stripe (src/actions/suscripciones/ está vacío) ni el mapeo plan -> price
  // de Stripe, así que no hay contra qué conciliar el evento. Cuando se
  // implemente va AQUÍ: firma e idempotencia ya quedaron resueltas arriba y
  // no hay forma de agregar negocio salteándolas.
  console.log("[webhook:stripe] evento verificado", { id: evento.id, tipo: evento.type });

  await marcarProcesado(evento.id);
  return NextResponse.json({ received: true });
}
