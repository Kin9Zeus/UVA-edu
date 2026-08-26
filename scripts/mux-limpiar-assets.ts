/**
 * Drena `mux_assets_pendientes_eliminacion`: borra contra la API real de Mux
 * cualquier asset que siga con `eliminado = false`.
 *
 * Uso: npm run mux:limpiar
 *
 * Por qué existe (P1-5, AUDIT-2026-08-26.md)
 * -------------------------------------------
 * El webhook (src/app/api/webhooks/mux/route.ts, video.asset.ready) ya
 * intenta borrar el asset viejo en el momento del reemplazo. Este script es
 * la red de seguridad para los dos casos que ese intento en caliente no
 * cubre:
 *   1. Filas que quedaron en `eliminado = false` porque el borrado en
 *      caliente falló (red, rate limit de Mux, token sin permiso ese día).
 *   2. El backlog que ya existía en la tabla antes de que el webhook
 *      intentara el borrado en caliente (la cola se creó en
 *      prisma/migrations/20260826000000_cola_eliminacion_assets_mux sin
 *      ningún consumidor).
 *
 * Pensado para correr a mano desde el panel de quien administre Mux, o
 * programado (cron de Railway, GitHub Actions con schedule) apuntando a
 * `npm run mux:limpiar` — no necesita que el webhook ni el dominio de la
 * app estén levantados: es una llamada saliente hacia la API de Mux, no un
 * endpoint que Mux tenga que alcanzar.
 *
 * Idempotente: un asset ya borrado responde 404 (NotFoundError), y este
 * script lo trata como éxito igual que eliminarAssetMux()
 * (src/lib/mux/limpieza.ts, misma regla) — reintentar una fila ya limpiada
 * por otra corrida no es un error.
 *
 * No usa el cliente compartido de src/lib/mux/client.ts a propósito: ese
 * módulo lee MUX_TOKEN_ID/MUX_TOKEN_SECRET de process.env en su ámbito de
 * módulo, y un import estático se resuelve ANTES que loadEnvFile() de abajo
 * (hoisting de ESM) — llegaría con las variables vacías. Este script arma
 * su propio cliente después de cargar el .env, mismo motivo por el que
 * scripts/webhook-test.ts importa las rutas de los webhooks con `await
 * import()` en vez de en el top del archivo.
 *
 * Sale con código 1 si algún borrado falló, para poder usarse como chequeo
 * de monitoreo (¿la cola se está vaciando o se está acumulando?).
 */

process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";
import Mux, { NotFoundError } from "@mux/mux-node";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error("\n❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.\n");
  process.exit(1);
}
if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  console.error("\n❌ Faltan MUX_TOKEN_ID / MUX_TOKEN_SECRET en .env.local.\n");
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const mux = new Mux({ tokenId: MUX_TOKEN_ID, tokenSecret: MUX_TOKEN_SECRET });

const LOTE = 50;

async function main() {
  const { data: pendientes, error } = await supabase
    .from("mux_assets_pendientes_eliminacion")
    .select("id, id_asset_mux")
    .eq("eliminado", false)
    .limit(LOTE);

  if (error) {
    console.error(`\n❌ No pude leer mux_assets_pendientes_eliminacion: ${error.message}\n`);
    process.exit(1);
  }

  if (!pendientes || pendientes.length === 0) {
    console.log("\n✅ No hay assets pendientes de borrar. La cola está vacía.\n");
    return;
  }

  console.log(`\nBorrando ${pendientes.length} asset(s) pendiente(s) de Mux...\n`);

  let borrados = 0;
  let fallidos = 0;

  for (const fila of pendientes) {
    const assetId = fila.id_asset_mux as string;
    let borrado = false;
    let errorBorrado: unknown = null;

    try {
      await mux.video.assets.delete(assetId);
      borrado = true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        borrado = true; // ya no existe: mismo resultado que borrarlo ahora
      } else {
        errorBorrado = error;
      }
    }

    if (borrado) {
      const { error: errorUpdate } = await supabase
        .from("mux_assets_pendientes_eliminacion")
        .update({ eliminado: true, eliminado_en: new Date().toISOString() })
        .eq("id", fila.id);

      if (errorUpdate) {
        fallidos += 1;
        console.error(`⚠️  ${assetId} — se borró en Mux pero no pude marcar la fila: ${errorUpdate.message}`);
      } else {
        borrados += 1;
        console.log(`✅ ${assetId}`);
      }
    } else {
      fallidos += 1;
      const mensaje = errorBorrado instanceof Error ? errorBorrado.message : String(errorBorrado);
      console.error(`❌ ${assetId} — ${mensaje}`);
    }
  }

  console.log(`\n${borrados} borrado(s), ${fallidos} fallido(s) de ${pendientes.length}.`);
  if (fallidos > 0) {
    console.log("   Las filas fallidas se quedan en la cola para la próxima corrida.\n");
    process.exitCode = 1;
  } else {
    console.log("");
  }
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
