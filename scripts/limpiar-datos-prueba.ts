/**
 * Borra datos de prueba que quedaron en producción. Registro versionado de
 * cada limpieza: se agrega una entrada a LIMPIEZAS, nunca se edita a mano en
 * el panel de Supabase.
 *
 * Borra SOLO los IDs fijos de abajo, así que se puede volver a correr sin
 * riesgo: nunca toca una fila creada después. Las entradas ya ejecutadas se
 * quedan como registro (no encuentran nada y no hacen nada).
 *
 * Antes de borrar guarda las filas en `respaldos/datos-prueba-<fecha>.json`
 * (ignorado por git: lleva ids de usuario). Todo el borrado va en una sola
 * transacción, en el orden de LIMPIEZAS (hijas antes que padres).
 *
 * No va en supabase/sql/: `npm run db:rls` reaplica todos esos archivos en
 * cada corrida. Corre con el rol dueño de la base (DATABASE_URL), como
 * mantenimiento puntual; la RLS de la app no cambia.
 *
 * Uso:
 *   ENV_FILE=.env.produccion.local npm run db:limpiar-datos-prueba                       # solo lista
 *   ENV_FILE=.env.produccion.local npm run db:limpiar-datos-prueba -- --confirmar=<ref>  # borra
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

/** 2026-10-02 — las 9 reseñas del equipo que daban promedio a la ficha pública del curso APU. */
const RESENAS_EQUIPO = [
  "38e9552b-467c-4986-a231-e5fde387a370",
  "ec7616f2-0f0e-4b07-b237-970e8b6a5d23",
  "0e6a4ee2-854b-41dc-b04c-da998ce9aeef",
  "c3254260-ca3b-4ec7-80dc-9084f308c523",
  "ed77d799-9bda-4b05-a7bb-299a41897184",
  "54b1ce8a-56dc-43f8-81c0-04a3936189f3",
  "4143ff78-d788-419d-8733-9f5959dd11ed",
  "4af34c04-d2cf-4c9a-80c9-32a49cffc99a",
  "352fb42e-b4ef-4b0e-81fc-9da4ace81099",
];

/** 2026-10-02 — 11 "Instructor RLS test …" que dejaron corridas de test:rls del
 * 28-ago al 7-sep contra producción (CI apuntaba ahí). Sin cursos asociados. */
const INSTRUCTORES_RLS_TEST = [
  "c3397f0a-ae6a-4f2d-84a3-db987767a721",
  "5821cc94-ddfa-4a06-9df3-82c21fd3a626",
  "ed41923d-7629-4349-9955-8ad9c8af13a1",
  "36e3e792-00ab-4e43-a61d-bf4a03ee9f94",
  "d8f12f5b-5892-4ea4-b650-08a7ec2b92d9",
  "0b0a8443-9877-4081-915c-30b8336ad75a",
  "0c29e890-cd89-46b5-b18a-70824ca20a85",
  "ec1b58cc-024e-4b4e-abb3-3357121c0f9c",
  "d955602f-d8e5-437d-a8b3-5e401e0594dd",
  "e22cfda9-c629-402a-9d56-9c8aaaaef4f8",
  "5cdefda9-68d3-43e4-9f4d-64f026276387",
];

/** En orden de borrado. `tabla` y `columna` son constantes de este archivo, nunca entrada externa. */
const LIMPIEZAS: { tabla: string; columna: string; ids: string[] }[] = [
  { tabla: "curso_calificacion_reacciones", columna: "id_calificacion", ids: RESENAS_EQUIPO },
  { tabla: "curso_calificaciones", columna: "id", ids: RESENAS_EQUIPO },
  { tabla: "instructores", columna: "id", ids: INSTRUCTORES_RLS_TEST },
];

const CONFIRMACION = process.argv.find((arg) => arg.startsWith("--confirmar="))?.slice("--confirmar=".length);

function abortar(mensaje: string): never {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

/** Una etiqueta legible por fila, sin saber de antemano qué tabla es. */
function etiqueta(fila: Record<string, unknown>): string {
  return String(fila.nombre ?? fila.titulo ?? fila.comentario ?? fila.id ?? "").slice(0, 60);
}

async function main(): Promise<void> {
  const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL) abortar("Faltan DATABASE_URL o NEXT_PUBLIC_SUPABASE_URL.");
  const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  console.log(`\n🎯 Proyecto: ${ref}`);

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const encontradas: Record<string, Record<string, unknown>[]> = {};
    for (const { tabla, columna, ids } of LIMPIEZAS) {
      const { rows } = await db.query(`select * from public.${tabla} where ${columna} = any($1::uuid[])`, [ids]);
      if (rows.length === 0) continue;
      encontradas[tabla] = rows;
      console.log(`\n${tabla}: ${rows.length}`);
      for (const fila of rows) console.log(`   ${etiqueta(fila)}`);
    }

    if (Object.keys(encontradas).length === 0) {
      console.log("✅ No queda ningún dato de prueba de la lista. Nada que hacer.\n");
      return;
    }
    if (CONFIRMACION === undefined) {
      console.log(`\nSolo listado. Para borrar: npm run db:limpiar-datos-prueba -- --confirmar=${ref}\n`);
      return;
    }
    if (CONFIRMACION !== ref) abortar(`--confirmar=${CONFIRMACION} no coincide con el proyecto ${ref}.`);

    mkdirSync("respaldos", { recursive: true });
    const respaldo = `respaldos/datos-prueba-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(respaldo, JSON.stringify({ proyecto: ref, filas: encontradas }, null, 2));
    console.log(`\n💾 Respaldo: ${respaldo}`);

    await db.query("begin");
    for (const { tabla, columna, ids } of LIMPIEZAS) {
      const { rowCount } = await db.query(`delete from public.${tabla} where ${columna} = any($1::uuid[])`, [ids]);
      if (rowCount) console.log(`🗑️  ${tabla}: ${rowCount} borradas`);
    }
    await db.query("commit");
    console.log("");
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
