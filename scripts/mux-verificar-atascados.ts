/**
 * Alerta si alguna lección lleva demasiado tiempo sin salir de un estado
 * intermedio de procesamiento de Mux (SUBIENDO/PROCESANDO).
 *
 * Uso: npm run mux:verificar-atascados
 *
 * Por qué existe (Monitoreo/alertas/respaldos, "Alerta específica si falla
 * el webhook de Mux")
 * -------------------------------------------------------------------------
 * src/app/api/webhooks/mux/route.ts solo actualiza `estado_procesamiento` a
 * LISTO o ERROR cuando Mux le manda un evento. Si Mux nunca lo manda (el
 * webhook está mal configurado, la URL cambió, Mux tiene un incidente, la
 * firma deja de validar por una rotación de secreto), la lección se queda
 * en el estado en el que quedó al pedir el Direct Upload — sin ningún error
 * visible para nadie, ni en Sentry ni en el panel de admin, porque no hay
 * ninguna fila con estado ERROR: simplemente nunca se movió.
 *
 * Nota: el enum EstadoProcesamientoLeccion tiene SUBIENDO, PROCESANDO,
 * LISTO, ERROR (prisma/schema.prisma), pero ningún camino del código actual
 * escribe PROCESANDO — src/actions/admin/mux.ts solo pone SUBIENDO al pedir
 * el upload, y el webhook solo escribe LISTO/ERROR. SUBIENDO es entonces el
 * estado que de verdad se queda colgado hoy; se vigilan los dos por si en
 * el futuro se agrega esa transición.
 *
 * `estado_procesamiento` además arranca en SUBIENDO por defecto desde que
 * se crea la lección (prisma/schema.prisma), antes de que nadie pida ningún
 * upload — toda lección recién creada en el panel de admin vive así hasta
 * que alguien sube un video, y eso NO es un incidente. La señal de que sí
 * se inició una subida de verdad es `id_mux_upload_id`: solo se llena en
 * iniciarSubidaVideoLeccion (src/actions/admin/mux.ts), justo antes de
 * pedirle el Direct Upload a Mux. Por eso el filtro exige que no sea null:
 * sin él, cada lección de seed sin video real se reporta como atascada
 * (falso positivo confirmado corriendo esto contra la base real).
 *
 * Pensado para correr programado (cron de Railway, `schedule:` de GitHub
 * Actions) apuntando a `npm run mux:verificar-atascados` — igual que
 * scripts/mux-limpiar-assets.ts, no necesita que la app esté levantada.
 *
 * Sale con código 1 si encuentra alguna lección atascada, para poder
 * usarse como chequeo de monitoreo.
 */

// .env.local no existe en CI, donde las variables llegan del entorno
// (mismo patrón que scripts/apply-rls.ts, scripts/rls-test.ts).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error(
    "\n❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local en local, secrets en CI).\n",
  );
  process.exit(1);
}

// Sentry no se inicializa solo en un script tsx (eso lo hace
// src/instrumentation.ts, que solo corre dentro del runtime de Next.js) —
// hay que iniciarlo a mano aquí, igual que en el propio instrumentation.ts.
// Sin DSN el SDK no envía nada; el script igual falla con código 1 y el log
// de la consola queda como respaldo.
Sentry.init({ dsn: process.env.SENTRY_DSN });

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Un video real (no los de 9-31s de los fixtures de prueba) puede tardar
// bastante en subir y procesar; 120 min es holgado para no generar falsos
// positivos con archivos grandes, y configurable por si hace falta ajustar
// sin tocar código.
const UMBRAL_MINUTOS = Number(process.env.MUX_ATASCADO_UMBRAL_MINUTOS ?? 120);

async function main() {
  const umbralIso = new Date(Date.now() - UMBRAL_MINUTOS * 60_000).toISOString();

  const { data: atascadas, error } = await supabase
    .from("lecciones")
    .select("id, titulo, estado_procesamiento, actualizado_en, id_mux_upload_id")
    .in("estado_procesamiento", ["SUBIENDO", "PROCESANDO"])
    .not("id_mux_upload_id", "is", null)
    .lt("actualizado_en", umbralIso);

  if (error) {
    console.error(`\n❌ No pude leer la tabla lecciones: ${error.message}\n`);
    process.exit(1);
  }

  if (!atascadas || atascadas.length === 0) {
    console.log(`\n✅ Ninguna lección lleva más de ${UMBRAL_MINUTOS} min en SUBIENDO/PROCESANDO.\n`);
    return;
  }

  const mensaje = `${atascadas.length} lección(es) llevan más de ${UMBRAL_MINUTOS} min sin salir de SUBIENDO/PROCESANDO — probable webhook de Mux caído o mal configurado.`;

  console.error(`\n❌ ${mensaje}`);
  for (const leccion of atascadas) {
    console.error(
      `   - ${leccion.id} "${leccion.titulo}" — ${leccion.estado_procesamiento} desde ${leccion.actualizado_en} (upload_id: ${leccion.id_mux_upload_id ?? "sin registrar"})`,
    );
  }
  console.error("");

  const eventId = Sentry.captureMessage(mensaje, {
    level: "error",
    tags: { area: "mux-atascado" },
    extra: {
      umbralMinutos: UMBRAL_MINUTOS,
      lecciones: atascadas.map((l) => ({
        id: l.id,
        titulo: l.titulo,
        estado: l.estado_procesamiento,
        actualizadoEn: l.actualizado_en,
      })),
    },
  });

  // El proceso está por terminar (process.exit más abajo): sin flush, el
  // evento puede quedarse en el buffer del SDK y nunca salir por red.
  await Sentry.flush(5000);

  console.error(`   Sentry event: ${eventId}\n`);
  process.exit(1);
}

main().catch(async (error) => {
  console.error("\n❌ Error inesperado:", error);
  await Sentry.flush(5000).catch(() => {});
  process.exit(1);
});
