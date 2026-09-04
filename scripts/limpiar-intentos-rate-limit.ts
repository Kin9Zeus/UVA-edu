/**
 * Barre las filas caducadas de las tres tablas de rate limiting
 * (private.intentos_check_email, intentos_verificar_certificado,
 * intentos_canjear_codigo).
 *
 * Uso: npm run rate-limit:limpiar
 *
 * Por qué existe (AUDIT-2026-09-04.md, P1-2 y P3-4)
 * ------------------------------------------------
 * Ninguna de las tres tablas se vacía nunca: acumulan una fila por clave
 * desde que se crearon. `limpiar_intentos_canjear_codigo` (SQL 023) existe
 * pero es por usuario y solo corre tras un canje exitoso.
 *
 * Mientras la IP salía del primer valor de `x-forwarded-for`, esto era un
 * agravante de P1-2: la clave la elegía el cliente, así que cada valor
 * nuevo insertaba una fila y un endpoint anónimo podía escribir en la base
 * sin límite. Con src/lib/clientIp.ts leyendo la cadena desde la derecha
 * eso ya no se puede forzar, y lo que queda es higiene: filas que dejaron
 * de significar algo hace tiempo.
 *
 * Toda la lógica (incluido el margen y la guarda de bloqueos vigentes) vive
 * en `public.limpiar_intentos_rate_limit()`, SQL 063 — este script solo la
 * invoca, igual que mux-limpiar-assets.ts drena su cola. Es idempotente:
 * correrlo dos veces seguidas no hace nada la segunda vez.
 *
 * Pensado para un cron (Railway) junto a `certificados:notificar`. Mientras
 * no esté programado NO corre solo: sin cron, esto solo limpia cuando
 * alguien lo ejecuta a mano.
 */

import { createClient } from "@supabase/supabase-js";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error(
    "\n❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local en local, secrets en CI).\n",
  );
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase.rpc("limpiar_intentos_rate_limit");

  if (error) {
    console.error(`\n❌ limpiar_intentos_rate_limit falló: ${error.message}\n`);
    process.exit(1);
  }

  const filas = (data ?? []) as { tabla: string; filas_borradas: number }[];
  const total = filas.reduce((acc, fila) => acc + fila.filas_borradas, 0);

  if (total === 0) {
    console.log("\n✅ Nada que limpiar: no hay filas caducadas.\n");
    return;
  }

  console.log(`\n✅ ${total} fila(s) caducada(s) eliminada(s):`);
  for (const fila of filas) {
    console.log(`   ${fila.tabla}: ${fila.filas_borradas}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
