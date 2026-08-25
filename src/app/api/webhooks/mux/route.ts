import { type NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { marcarProcesado, registrarEvento } from "@/lib/webhooks/eventos";
import { logError } from "@/lib/log";

// A diferencia de Stripe, `new Mux({ tokenId: "", tokenSecret: "" })` no
// lanza, así que se puede construir en el ámbito del módulo sin riesgo de
// tumbar la ruta con las variables vacías. La verificación de firma solo usa
// MUX_WEBHOOK_SECRET; tokenId/tokenSecret son para llamar a la API de Mux.
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

/** El evento que manda Mux, con los campos que este handler necesita. */
type EventoMux = { id: string; type: string; data?: { id?: string } };

export async function POST(request: NextRequest) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    logError("webhook:mux", "falta MUX_WEBHOOK_SECRET; no se procesa nada", null, { area: "webhook" });
    return NextResponse.json({ error: "webhook no configurado" }, { status: 500 });
  }

  const payload = await request.text();

  let evento: EventoMux;
  try {
    // unwrap() verifica la firma y recién entonces parsea. El SDK v14 espera
    // las cabeceras completas (lee `mux-signature` por su cuenta), no el valor
    // suelto — y el cuerpo como string crudo, porque la firma se calcula sobre
    // "<timestamp>.<body>" y cualquier reserialización lo invalidaría.
    // Verifica además que el timestamp no tenga más de 5 minutos, lo que corta
    // el replay de un evento legítimo capturado.
    evento = (await mux.webhooks.unwrap(payload, request.headers, secret)) as EventoMux;
  } catch (error) {
    logError("webhook:mux", "firma inválida", error, { area: "webhook" });
    return NextResponse.json({ error: "firma inválida" }, { status: 400 });
  }

  const registro = await registrarEvento({
    proveedor: "mux",
    idEventoExterno: evento.id,
    tipoEvento: evento.type,
    payload: evento,
  });

  if (registro.estado === "duplicado") {
    return NextResponse.json({ received: true, duplicado: true });
  }
  if (registro.estado === "error") {
    logError("webhook:mux", "no se pudo registrar el evento", null, {
      area: "webhook",
      mensaje: registro.mensaje,
      idEvento: evento.id,
    });
    return NextResponse.json({ error: "no se pudo registrar el evento" }, { status: 500 });
  }

  // TODO: lógica de negocio por evento.type — video.asset.ready escribe
  // id_video_mux, duracion y estado_procesamiento = LISTO en la Lección;
  // video.asset.errored la deja en el estado de error (functional-spec.md
  // Flujo 09). Pendiente porque todavía no existe la subida Direct Upload que
  // asocia un asset de Mux a una lección (src/app/api/video/upload/ está
  // vacío), así que no hay a qué fila aplicarle el evento. Cuando exista va
  // AQUÍ, ya con firma e idempotencia resueltas.
  console.log("[webhook:mux] evento verificado", { id: evento.id, tipo: evento.type });

  await marcarProcesado(evento.id);
  return NextResponse.json({ received: true });
}
