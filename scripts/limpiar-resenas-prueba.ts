/**
 * Borra las reseñas de prueba que el equipo dejó en producción antes del
 * lanzamiento (la ficha pública del curso APU mostraba su promedio).
 *
 * Borra SOLO los IDs fijos de abajo — las 9 reseñas que había el 2026-10-02,
 * todas de cuentas del equipo o @uva.test. Por eso se puede volver a correr
 * sin riesgo: nunca toca una reseña creada después.
 *
 * Antes de borrar guarda las filas (reseñas + sus "me gusta") en
 * `respaldos/resenas-prueba-<fecha>.json` (ignorado por git: lleva ids de
 * usuario).
 *
 * No va en supabase/sql/: `npm run db:rls` reaplica todos esos archivos en
 * cada corrida. Corre con el rol dueño de la base (DATABASE_URL), como
 * mantenimiento puntual; la app sigue sin poder borrar reseñas (RLS de 102).
 *
 * Uso:
 *   npm run db:limpiar-resenas-prueba                         # solo lista
 *   npm run db:limpiar-resenas-prueba -- --confirmar=<ref>    # borra
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const IDS_RESENAS_PRUEBA = [
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

const CONFIRMACION = process.argv.find((arg) => arg.startsWith("--confirmar="))?.slice("--confirmar=".length);

function abortar(mensaje: string): never {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL) abortar("Faltan DATABASE_URL o NEXT_PUBLIC_SUPABASE_URL.");
  const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  console.log(`\n🎯 Proyecto: ${ref}`);

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows: resenas } = await db.query(
      `select cc.*, cu.titulo as curso, p.correo as autor
         from curso_calificaciones cc
         join cursos cu on cu.id = cc.id_curso
         join perfiles p on p.id = cc.id_usuario
        where cc.id = any($1::uuid[])
        order by cu.titulo, cc.creado_en`,
      [IDS_RESENAS_PRUEBA],
    );
    const { rows: reacciones } = await db.query(
      "select * from curso_calificacion_reacciones where id_calificacion = any($1::uuid[])",
      [IDS_RESENAS_PRUEBA],
    );

    if (resenas.length === 0) {
      console.log("✅ No queda ninguna reseña de prueba. Nada que hacer.\n");
      return;
    }
    console.table(resenas.map((r) => ({ curso: r.curso, autor: r.autor, puntuacion: r.puntuacion, eliminado: r.eliminado })));
    console.log(`${resenas.length} reseñas · ${reacciones.length} "me gusta"`);

    if (CONFIRMACION === undefined) {
      console.log(`\nSolo listado. Para borrar: npm run db:limpiar-resenas-prueba -- --confirmar=${ref}\n`);
      return;
    }
    if (CONFIRMACION !== ref) abortar(`--confirmar=${CONFIRMACION} no coincide con el proyecto ${ref}.`);

    mkdirSync("respaldos", { recursive: true });
    const respaldo = `respaldos/resenas-prueba-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(respaldo, JSON.stringify({ proyecto: ref, resenas, reacciones }, null, 2));
    console.log(`💾 Respaldo: ${respaldo}`);

    await db.query("begin");
    const borradasReacciones = await db.query(
      "delete from curso_calificacion_reacciones where id_calificacion = any($1::uuid[])",
      [IDS_RESENAS_PRUEBA],
    );
    const borradasResenas = await db.query("delete from curso_calificaciones where id = any($1::uuid[])", [
      IDS_RESENAS_PRUEBA,
    ]);
    await db.query("commit");
    console.log(`🗑️  Borradas: ${borradasResenas.rowCount} reseñas · ${borradasReacciones.rowCount} "me gusta"\n`);
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
