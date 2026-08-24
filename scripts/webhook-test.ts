/**
 * Prueba de los webhooks entrantes: verificación de firma e idempotencia.
 *
 * Uso: npm run test:webhooks
 *
 * No necesita cuenta de Stripe, Wompi ni Mux. La verificación de firma es
 * HMAC/SHA256 contra un secreto compartido, así que se genera un secreto
 * local, se firma un payload con el mismo algoritmo que usa la pasarela y se
 * comprueba el comportamiento del handler. Eso es exactamente lo que hay que
 * probar: que un cuerpo manipulado no pase.
 *
 * Qué cubre, por cada uno de los tres:
 *   1. Firma válida -> 200.
 *   2. Cuerpo manipulado después de firmar -> 400 (el caso que importa).
 *   3. Firma ausente -> 400.
 *   4. Secreto sin configurar -> 500, NUNCA 200 (un 2xx le diría a la
 *      pasarela "recibido" y el evento se perdería para siempre).
 *   5. Reenvío del mismo evento -> 200 con duplicado:true y una sola fila en
 *      eventos_webhook (idempotencia, CLAUDE.md 3.1).
 *
 * Escribe en eventos_webhook con la Service Role Key y borra lo que creó al
 * terminar, pase o falle. Sale con código 1 si algo falló, para usarse como
 * gate de CI.
 */

process.loadEnvFile(".env.local");

import { createHash, createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SUPABASE || !SERVICE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.");
}

// Secretos de prueba: los handlers los leen de process.env, así que se fijan
// antes de importar las rutas. No son credenciales de nadie.
const SECRETO_STRIPE = "whsec_" + randomUUID().replace(/-/g, "");
const SECRETO_MUX = "muxsec_" + randomUUID().replace(/-/g, "");
const SECRETO_WOMPI = "wompisec_" + randomUUID().replace(/-/g, "");

const resultados: { nombre: string; ok: boolean; detalle?: string }[] = [];
const idsCreados: string[] = [];

function registrar(nombre: string, ok: boolean, detalle?: string) {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? ` -- ${detalle}` : ""}`);
}

type Handler = (peticion: Request) => Promise<Response>;

async function esperarEstado(nombre: string, handler: Handler, peticion: Request, esperado: number) {
  const respuesta = await handler(peticion);
  const ok = respuesta.status === esperado;
  registrar(nombre, ok, ok ? String(esperado) : `esperaba ${esperado}, recibió ${respuesta.status}`);
  return respuesta;
}

function pedido(cuerpo: string, cabeceras: Record<string, string>): Request {
  return new Request("https://uva.test/api/webhooks", {
    method: "POST",
    body: cuerpo,
    headers: { "content-type": "application/json", ...cabeceras },
  });
}

/** Stripe y Mux comparten esquema: t=<unix>,v1=<hmac-sha256 de "<t>.<body>">. */
function firmaEsquemaT(cuerpo: string, secreto: string, segundosAtras = 0): string {
  const t = Math.floor(Date.now() / 1000) - segundosAtras;
  const v1 = createHmac("sha256", secreto).update(`${t}.${cuerpo}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

/** Wompi: SHA256( concat(valores) + timestamp + secreto ). Hash plano, no HMAC. */
function eventoWompiFirmado(secreto: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const transaccion = { id: `wompi-test-${randomUUID()}`, status: "APPROVED", amount_in_cents: 5000 };
  const concatenado =
    `${transaccion.id}${transaccion.status}${transaccion.amount_in_cents}` + String(timestamp) + secreto;
  const checksum = createHash("sha256").update(concatenado, "utf8").digest("hex");
  return {
    cuerpo: JSON.stringify({
      event: "transaction.updated",
      data: { transaction: transaccion },
      timestamp,
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum,
      },
    }),
    checksum,
  };
}

async function main() {
  process.env.STRIPE_WEBHOOK_SECRET = SECRETO_STRIPE;
  process.env.MUX_WEBHOOK_SECRET = SECRETO_MUX;
  process.env.WOMPI_EVENTS_SECRET = SECRETO_WOMPI;

  const stripePOST = (await import("@/app/api/webhooks/stripe/route")).POST as unknown as Handler;
  const muxPOST = (await import("@/app/api/webhooks/mux/route")).POST as unknown as Handler;
  const wompiPOST = (await import("@/app/api/webhooks/wompi/route")).POST as unknown as Handler;

  // ------------------------------------------------------------------ STRIPE
  console.log("\n=== STRIPE ===\n");
  const idStripe = `evt_test_${randomUUID().replace(/-/g, "")}`;
  idsCreados.push(idStripe);
  const cuerpoStripe = JSON.stringify({
    id: idStripe,
    type: "checkout.session.completed",
    data: { object: { monto: 5000 } },
  });

  await esperarEstado(
    "stripe: firma válida -> 200",
    stripePOST,
    pedido(cuerpoStripe, { "stripe-signature": firmaEsquemaT(cuerpoStripe, SECRETO_STRIPE) }),
    200,
  );

  const stripeManipulado = JSON.stringify({
    id: idStripe,
    type: "checkout.session.completed",
    data: { object: { monto: 999999 } },
  });
  await esperarEstado(
    "stripe: cuerpo manipulado tras firmar -> 400",
    stripePOST,
    pedido(stripeManipulado, { "stripe-signature": firmaEsquemaT(cuerpoStripe, SECRETO_STRIPE) }),
    400,
  );

  await esperarEstado("stripe: sin cabecera de firma -> 400", stripePOST, pedido(cuerpoStripe, {}), 400);

  await esperarEstado(
    "stripe: firmado con otro secreto -> 400",
    stripePOST,
    pedido(cuerpoStripe, { "stripe-signature": firmaEsquemaT(cuerpoStripe, "whsec_secreto_del_atacante") }),
    400,
  );

  const stripeReenvio = await esperarEstado(
    "stripe: reenvío del mismo evento -> 200",
    stripePOST,
    pedido(cuerpoStripe, { "stripe-signature": firmaEsquemaT(cuerpoStripe, SECRETO_STRIPE) }),
    200,
  );
  const stripeCuerpoReenvio = (await stripeReenvio.json()) as { duplicado?: boolean };
  registrar(
    "stripe: el reenvío se reconoce como duplicado (no reprocesa)",
    stripeCuerpoReenvio.duplicado === true,
    JSON.stringify(stripeCuerpoReenvio),
  );

  // --------------------------------------------------------------------- MUX
  console.log("\n=== MUX ===\n");
  const idMux = `mux_evt_${randomUUID().replace(/-/g, "")}`;
  idsCreados.push(idMux);
  const cuerpoMux = JSON.stringify({ id: idMux, type: "video.asset.ready", data: { id: "asset-123" } });

  await esperarEstado(
    "mux: firma válida -> 200",
    muxPOST,
    pedido(cuerpoMux, { "mux-signature": firmaEsquemaT(cuerpoMux, SECRETO_MUX) }),
    200,
  );

  const muxManipulado = JSON.stringify({
    id: idMux,
    type: "video.asset.ready",
    data: { id: "asset-del-atacante" },
  });
  await esperarEstado(
    "mux: cuerpo manipulado tras firmar -> 400",
    muxPOST,
    pedido(muxManipulado, { "mux-signature": firmaEsquemaT(cuerpoMux, SECRETO_MUX) }),
    400,
  );

  await esperarEstado("mux: sin cabecera de firma -> 400", muxPOST, pedido(cuerpoMux, {}), 400);

  await esperarEstado(
    "mux: firma válida pero de hace 400 s -> 400 (corta el replay)",
    muxPOST,
    pedido(cuerpoMux, { "mux-signature": firmaEsquemaT(cuerpoMux, SECRETO_MUX, 400) }),
    400,
  );

  // ------------------------------------------------------------------- WOMPI
  console.log("\n=== WOMPI ===\n");
  const wompiOk = eventoWompiFirmado(SECRETO_WOMPI);
  idsCreados.push(wompiOk.checksum);

  await esperarEstado("wompi: checksum válido -> 200", wompiPOST, pedido(wompiOk.cuerpo, {}), 200);

  // Se cambia el monto conservando el checksum original: es el ataque real, un
  // tercero que descubre la URL y manda un pago aprobado inventado.
  const wompiAlterado = JSON.parse(wompiOk.cuerpo) as {
    data: { transaction: { amount_in_cents: number } };
  };
  wompiAlterado.data.transaction.amount_in_cents = 1;
  await esperarEstado(
    "wompi: monto alterado conservando el checksum -> 400",
    wompiPOST,
    pedido(JSON.stringify(wompiAlterado), {}),
    400,
  );

  await esperarEstado(
    "wompi: sin bloque signature -> 400",
    wompiPOST,
    pedido(JSON.stringify({ event: "transaction.updated", data: {}, timestamp: 1 }), {}),
    400,
  );

  const wompiReenvio = await esperarEstado(
    "wompi: reenvío del mismo evento -> 200",
    wompiPOST,
    pedido(wompiOk.cuerpo, {}),
    200,
  );
  const wompiCuerpoReenvio = (await wompiReenvio.json()) as { duplicado?: boolean };
  registrar(
    "wompi: el reenvío se reconoce como duplicado",
    wompiCuerpoReenvio.duplicado === true,
    JSON.stringify(wompiCuerpoReenvio),
  );

  // ------------------------------------------- Secreto ausente = fail-closed
  console.log("\n=== SIN SECRETO CONFIGURADO ===\n");
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.MUX_WEBHOOK_SECRET;
  delete process.env.WOMPI_EVENTS_SECRET;

  await esperarEstado(
    "stripe: sin STRIPE_WEBHOOK_SECRET -> 500, no 200",
    stripePOST,
    pedido(cuerpoStripe, { "stripe-signature": firmaEsquemaT(cuerpoStripe, SECRETO_STRIPE) }),
    500,
  );
  await esperarEstado(
    "mux: sin MUX_WEBHOOK_SECRET -> 500, no 200",
    muxPOST,
    pedido(cuerpoMux, { "mux-signature": firmaEsquemaT(cuerpoMux, SECRETO_MUX) }),
    500,
  );
  await esperarEstado(
    "wompi: sin WOMPI_EVENTS_SECRET -> 500, no 200",
    wompiPOST,
    pedido(wompiOk.cuerpo, {}),
    500,
  );

  // --------------------------------------- Una sola fila por evento en la base
  console.log("\n=== IDEMPOTENCIA EN LA BASE ===\n");
  const admin = createClient(URL_SUPABASE!, SERVICE_KEY!, { auth: { persistSession: false } });
  const { data: filas, error } = await admin
    .from("eventos_webhook")
    .select("id_evento_externo, procesado")
    .in("id_evento_externo", idsCreados);

  if (error) {
    registrar("eventos_webhook: se pueden leer las filas creadas", false, error.message);
    return;
  }

  registrar(
    `eventos_webhook: ${idsCreados.length} eventos -> ${filas.length} filas, pese a los reenvíos`,
    filas.length === idsCreados.length,
  );
  registrar(
    "eventos_webhook: todas quedaron procesado = true",
    filas.every((fila) => fila.procesado === true),
  );
}

async function limpiar() {
  if (idsCreados.length === 0) return;
  const admin = createClient(URL_SUPABASE!, SERVICE_KEY!, { auth: { persistSession: false } });
  const { error } = await admin.from("eventos_webhook").delete().in("id_evento_externo", idsCreados);
  console.log(error ? `\nNo pude limpiar: ${error.message}` : "\nDatos de prueba borrados.");
}

main()
  .catch((error) => {
    console.error("\nError inesperado:", error);
    registrar("la suite corrió hasta el final", false, String(error));
  })
  .finally(async () => {
    await limpiar();
    const fallidos = resultados.filter((resultado) => !resultado.ok);
    if (fallidos.length > 0) {
      console.log(`\n${fallidos.length} prueba(s) FALLIDA(S):`);
      fallidos.forEach((fallo) => console.log(`  ${fallo.nombre}${fallo.detalle ? ` -- ${fallo.detalle}` : ""}`));
      process.exitCode = 1;
    } else {
      console.log(`\n${resultados.length}/${resultados.length} pruebas OK.`);
    }
  });
