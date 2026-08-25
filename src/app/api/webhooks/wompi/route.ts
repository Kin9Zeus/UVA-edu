import { createHash, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { marcarProcesado, registrarEvento } from "@/lib/webhooks/eventos";
import { logError } from "@/lib/log";

/**
 * Estructura del evento de Wompi que este handler necesita. `signature`
 * viaja DENTRO del cuerpo (no en una cabecera, a diferencia de Stripe y Mux):
 * `properties` lista las rutas cuyos valores entran al checksum, en orden.
 */
type EventoWompi = {
  event?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
  signature?: { properties?: string[]; checksum?: string };
};

/** Resuelve "transaction.id" contra `data`. Devuelve "" si el camino no existe. */
function valorEnRuta(data: Record<string, unknown> | undefined, ruta: string): string {
  let actual: unknown = data;
  for (const segmento of ruta.split(".")) {
    if (typeof actual !== "object" || actual === null) return "";
    actual = (actual as Record<string, unknown>)[segmento];
  }
  return actual === undefined || actual === null ? "" : String(actual);
}

function comparaSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual exige la misma longitud; comparar antes no filtra nada
  // útil, porque la longitud del checksum es fija y pública.
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  // OJO: es el "Secreto de eventos" del dashboard de Wompi, NO WOMPI_PRV_KEY.
  // La llave privada firma la integridad del checkout (el widget de pago); los
  // eventos usan un secreto aparte. Son valores distintos y confundirlos hace
  // que toda firma legítima se rechace.
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) {
    logError("webhook:wompi", "falta WOMPI_EVENTS_SECRET; no se procesa nada", null, { area: "webhook" });
    return NextResponse.json({ error: "webhook no configurado" }, { status: 500 });
  }

  const crudo = await request.text();

  let evento: EventoWompi;
  try {
    evento = JSON.parse(crudo) as EventoWompi;
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const propiedades = evento.signature?.properties;
  const checksumRecibido = evento.signature?.checksum;
  if (!Array.isArray(propiedades) || !checksumRecibido || evento.timestamp === undefined) {
    return NextResponse.json({ error: "falta la firma" }, { status: 400 });
  }

  // Wompi Eventos: SHA256( concat(valores de properties, en orden)
  //                        + timestamp + secreto de eventos ).
  // Es un hash plano, no un HMAC — el secreto va concatenado al final.
  const concatenado =
    propiedades.map((ruta) => valorEnRuta(evento.data, ruta)).join("") +
    String(evento.timestamp) +
    secret;
  const checksumEsperado = createHash("sha256").update(concatenado, "utf8").digest("hex");

  if (!comparaSeguro(checksumEsperado.toLowerCase(), checksumRecibido.toLowerCase())) {
    logError("webhook:wompi", "checksum inválido", null, { area: "webhook" });
    return NextResponse.json({ error: "firma inválida" }, { status: 400 });
  }

  // Wompi no manda un id de evento propio. El checksum sirve como clave de
  // idempotencia: depende de los valores del evento MÁS su timestamp, así que
  // un reenvío del mismo evento da el mismo checksum (se detecta como
  // duplicado) y dos cambios de estado distintos de la misma transacción dan
  // checksums distintos (se procesan ambos, como corresponde).
  const registro = await registrarEvento({
    proveedor: "wompi",
    idEventoExterno: checksumRecibido,
    tipoEvento: evento.event ?? "desconocido",
    payload: evento,
  });

  if (registro.estado === "duplicado") {
    return NextResponse.json({ received: true, duplicado: true });
  }
  if (registro.estado === "error") {
    logError("webhook:wompi", "no se pudo registrar el evento", null, {
      area: "webhook",
      mensaje: registro.mensaje,
      checksum: checksumRecibido,
    });
    return NextResponse.json({ error: "no se pudo registrar el evento" }, { status: 500 });
  }

  // TODO: lógica de negocio por evento.event — transaction.updated con
  // status APPROVED activa la Suscripción y registra el Pago; DECLINED/VOIDED
  // la dejan sin activar (functional-spec.md Flujo 06). Pendiente por lo mismo
  // que Stripe: no existe todavía el checkout que crea la transacción, así que
  // no hay contra qué conciliar. Va AQUÍ, con firma e idempotencia ya
  // resueltas arriba.
  console.log("[webhook:wompi] evento verificado", { evento: evento.event });

  await marcarProcesado(checksumRecibido);
  return NextResponse.json({ received: true });
}
