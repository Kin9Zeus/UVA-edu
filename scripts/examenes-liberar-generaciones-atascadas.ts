/**
 * Libera los trabajos de generación de examen que quedaron colgados en
 * PENDIENTE, y avisa.
 *
 * Uso: npm run examenes:liberar-atascados
 *
 * Por qué existe
 * -------------------------------------------------------------------------
 * La generación se dispara desde un Server Action que responde enseguida y
 * deja el trabajo caro dentro de `after()` (src/actions/admin/generacionExamen.ts).
 * `after()` sobrevive a la respuesta HTTP, pero NO sobrevive a que el proceso
 * muera: un redespliegue de Railway, un OOM o un reinicio a mitad de una
 * generación matan la continuación sin que nadie cierre la fila.
 *
 * Y esa fila abierta no es un residuo inofensivo. El índice parcial único
 * `trabajos_generacion_examen_uno_pendiente` (un solo PENDIENTE por curso) es
 * lo que impide dos corridas simultáneas; con un PENDIENTE huérfano, ese
 * cerrojo se convierte en un candado permanente y ESE CURSO NO SE PUEDE VOLVER
 * A GENERAR NUNCA. El síntoma que vería el administrador es un «ya hay una
 * generación en curso» eterno, sin nada corriendo por detrás.
 *
 * Por eso este script escribe, a diferencia de su hermano
 * scripts/mux-verificar-atascados.ts, que solo alerta: marcar el trabajo como
 * FALLIDO es lo que suelta el cerrojo. No se pierde información — el trabajo
 * queda en el historial con su motivo, y el examen del curso no se toca (si la
 * generación alcanzó a persistir preguntas antes de morir, ahí siguen; si no,
 * el curso queda como estaba).
 *
 * Nunca cancela una generación viva: el umbral se compara contra `creado_en`,
 * y es holgado a propósito (ver UMBRAL_MINUTOS).
 *
 * Pensado para correr programado (cron de Railway, `schedule:` de GitHub
 * Actions), igual que mux-verificar-atascados. No necesita la app levantada.
 *
 * Sale con código 1 si tuvo que liberar algo: que haya trabajos atascados
 * significa que un proceso murió a mitad, y eso merece aparecer en el monitoreo
 * aunque el script ya lo haya arreglado.
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
// src/instrumentation.ts, que solo corre dentro del runtime de Next.js).
// Sin DSN el SDK no envía nada; el log de consola y el código de salida
// quedan como respaldo.
Sentry.init({ dsn: process.env.SENTRY_DSN });

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Cuánto puede tardar una generación legítima antes de considerarla muerta.
 *
 * El techo real es un curso de MAXIMO_VIDEOS_POR_LLAMADA (40) transcripciones
 * en una sola llamada a Claude Opus 5 con razonamiento adaptativo — minutos,
 * no segundos. 20 min deja margen de sobra por encima de eso.
 *
 * Errar por largo es lo correcto acá: liberar de más MATA una generación que
 * estaba corriendo bien y deja que otra corrida la pise a mitad de la
 * escritura. Liberar de menos solo retrasa el arreglo hasta la siguiente
 * pasada del cron.
 */
const UMBRAL_MINUTOS = Number(process.env.GENERACION_ATASCADA_UMBRAL_MINUTOS ?? 20);

const MOTIVO =
  "Liberado automáticamente: el proceso que lo ejecutaba murió antes de terminar " +
  "(probable redespliegue o reinicio). Vuelve a generar el examen del curso.";

async function main() {
  const umbralIso = new Date(Date.now() - UMBRAL_MINUTOS * 60_000).toISOString();

  // UPDATE con filtro + .select(): una sola operación, sin ventana entre
  // "leer cuáles están atascados" y "cerrarlos". Con un SELECT previo, una
  // generación que terminara justo en medio se marcaría FALLIDA por encima de
  // su propio COMPLETADO.
  //
  // El `.eq("estado", "PENDIENTE")` no es redundante con el filtro de tiempo:
  // es lo que garantiza que nunca se pisa un trabajo ya cerrado.
  const { data: liberados, error } = await supabase
    .from("trabajos_generacion_examen")
    .update({
      estado: "FALLIDO",
      error: MOTIVO,
      finalizado_en: new Date().toISOString(),
    })
    .eq("estado", "PENDIENTE")
    .lt("creado_en", umbralIso)
    .select("id, id_curso, disparado_por, creado_en");

  if (error) {
    console.error(`\n❌ No pude liberar los trabajos atascados: ${error.message}\n`);
    await Sentry.flush(5000).catch(() => {});
    process.exit(1);
  }

  if (!liberados || liberados.length === 0) {
    console.log(
      `\n✅ Ningún trabajo de generación lleva más de ${UMBRAL_MINUTOS} min en PENDIENTE.\n`,
    );
    return;
  }

  const mensaje =
    `${liberados.length} trabajo(s) de generación de examen llevaban más de ${UMBRAL_MINUTOS} min ` +
    "en PENDIENTE y se marcaron FALLIDO — el proceso que los ejecutaba murió a mitad " +
    "(probable redespliegue). El cerrojo de esos cursos queda liberado.";

  console.error(`\n❌ ${mensaje}`);
  for (const trabajo of liberados) {
    console.error(
      `   - ${trabajo.id} — curso ${trabajo.id_curso}, disparado por ${trabajo.disparado_por}, creado ${trabajo.creado_en}`,
    );
  }
  console.error("");

  const eventId = Sentry.captureMessage(mensaje, {
    level: "error",
    tags: { area: "exam-generation" },
    extra: {
      umbralMinutos: UMBRAL_MINUTOS,
      trabajos: liberados.map((trabajo) => ({
        id: trabajo.id,
        cursoId: trabajo.id_curso,
        disparadoPor: trabajo.disparado_por,
        creadoEn: trabajo.creado_en,
      })),
    },
  });

  // El proceso está por terminar: sin flush, el evento puede quedarse en el
  // buffer del SDK y no salir nunca por red.
  await Sentry.flush(5000);

  console.error(`   Sentry event: ${eventId}\n`);
  process.exit(1);
}

main().catch(async (error) => {
  console.error("\n❌ Error inesperado:", error);
  await Sentry.flush(5000).catch(() => {});
  process.exit(1);
});
