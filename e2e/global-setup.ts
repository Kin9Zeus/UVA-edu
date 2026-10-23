import { Client } from "pg";

/** Proyecto de Supabase de staging (.env.local); producción nunca se toca. */
const REF_STAGING = "tmvmthdwapegypveaosd";

/**
 * Pone en cero el límite de `checkEmail` (20 por IP cada 15 min,
 * 023_rate_limit_check_email_y_canje.sql) antes de cada corrida. Todas las
 * pruebas salen de la misma IP y casi todas pasan por "Continuar" en /login:
 * dos corridas seguidas lo agotan y todo falla con "Demasiados intentos".
 * El límite no cambia; solo se borra el contador de staging.
 *
 * Sin `DATABASE_URL` (CI) se salta: allá la suite corre una vez y cabe.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[e2e] Sin DATABASE_URL: no se reinicia el límite de check-email.");
    return;
  }
  if (!url.includes(REF_STAGING) || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(REF_STAGING)) {
    console.log("[e2e] La base no es staging: no se reinicia el límite de check-email.");
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rowCount } = await client.query("delete from private.intentos_check_email");
    console.log(`[e2e] Límite de check-email de staging en cero (${rowCount ?? 0} filas).`);
  } finally {
    await client.end();
  }
}
