/**
 * Convierte una cuenta EXISTENTE en ADMINISTRADOR. Registro versionado de
 * cada promoción: se hace con este script, no a mano en el panel de Supabase.
 *
 * La cuenta tiene que existir ya (la persona se registra primero en la app,
 * con su propia contraseña). Aquí solo se le cambia el rol.
 *
 * El trigger `perfiles_bloquea_autopromocion` (013) solo deja cambiar el rol a
 * un administrador o al `service_role`. Este script corre con el rol dueño de
 * la base, sin sesión de usuario, así que declara `service_role` solo dentro
 * de su transacción (`set_config(..., true)` = local a la transacción).
 *
 * Por defecto solo muestra qué haría. Cambia algo únicamente con
 * `--confirmar=<ref>`, y deja constancia en la salida de quién era antes.
 *
 * Uso:
 *   ENV_FILE=.env.produccion.local npm run db:promover-admin -- correo@dominio.com
 *   ENV_FILE=.env.produccion.local npm run db:promover-admin -- correo@dominio.com --confirmar=<ref>
 */
import { Client } from "pg";

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const CONFIRMACION = process.argv.find((arg) => arg.startsWith("--confirmar="))?.slice("--confirmar=".length);
const CORREO = process.argv.slice(2).find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

function abortar(mensaje: string): never {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL) abortar("Faltan DATABASE_URL o NEXT_PUBLIC_SUPABASE_URL.");
  if (!CORREO || !CORREO.includes("@")) abortar("Falta el correo: npm run db:promover-admin -- correo@dominio.com");
  const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  console.log(`\n🎯 Proyecto: ${ref}`);

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query(
      `select p.id::text as id, u.email, p.rol::text as rol, p.estado::text as estado
         from auth.users u join public.perfiles p on p.id = u.id
        where lower(u.email) = $1 and p.anonimizado_en is null`,
      [CORREO],
    );
    if (rows.length !== 1) abortar(`No hay una cuenta activa con el correo ${CORREO}: tiene que registrarse primero en la app.`);
    const cuenta = rows[0];
    console.log(`   ${cuenta.email}: ${cuenta.rol} · ${cuenta.estado}`);

    if (cuenta.estado !== "ACTIVO") abortar(`La cuenta está ${cuenta.estado}: no se promueve.`);
    if (cuenta.rol === "ADMINISTRADOR") {
      console.log("✅ Ya es ADMINISTRADOR. Nada que hacer.\n");
      return;
    }
    if (CONFIRMACION === undefined) {
      console.log(`\nSolo listado. Para promover: npm run db:promover-admin -- ${CORREO} --confirmar=${ref}\n`);
      return;
    }
    if (CONFIRMACION !== ref) abortar(`--confirmar=${CONFIRMACION} no coincide con el proyecto ${ref}.`);

    await db.query("begin");
    await db.query("select set_config('request.jwt.claim.role', 'service_role', true)");
    const { rowCount } = await db.query("update public.perfiles set rol = 'ADMINISTRADOR' where id = $1::uuid", [cuenta.id]);
    if (rowCount !== 1) throw new Error(`Se esperaba actualizar 1 fila y fueron ${rowCount}.`);
    await db.query("commit");
    console.log(`✅ ${cuenta.email}: ${cuenta.rol} → ADMINISTRADOR\n`);
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Falló:", error);
  process.exitCode = 1;
});
