/**
 * Aplica los scripts SQL de `supabase/sql/` contra DATABASE_URL, en orden y
 * dentro de una sola transacción.
 *
 * Uso:
 *   npm run db:rls          # aplica (COMMIT)
 *   npm run db:rls:check    # aplica y hace ROLLBACK — verifica sin escribir
 *
 * Por qué existe
 * --------------
 * Hasta ahora estos 22 archivos se pegaban a mano en el SQL Editor de
 * Supabase, en orden, siguiendo instrucciones en comentarios. Eso hacía que
 * ningún entorno pudiera *demostrar* que los tenía aplicados: saltarse uno
 * solo reabre el hueco que ese script cerraba, y el peor caso está
 * documentado en 013_perfiles_bloquea_autopromocion.sql — sin ese trigger,
 * un estudiante puede hacer PATCH /rest/v1/perfiles con {"rol":"ADMINISTRADOR"}
 * y quedar como administrador de toda la plataforma. Ver AUDIT-2026-08-24.md,
 * hallazgo P0-1.
 *
 * Por qué NO son migraciones de Prisma
 * ------------------------------------
 * `prisma migrate dev` replica todas las migraciones en una shadow database
 * vacía para detectar drift. Esa base no tiene el schema `auth` de Supabase,
 * y estos scripts dependen de él en todas partes: `auth.uid()` en ~35
 * políticas, el trigger sobre `auth.users` (000), la FK
 * `perfiles.id -> auth.users(id)` (010) y lecturas de `auth.identities`
 * (007). Meterlos a `prisma/migrations/` rompería `npm run prisma:migrate`
 * para todo el equipo, salvo falsificando objetos internos de Supabase en la
 * shadow DB. Se prefirió un pipeline propio, automatizado y verificable.
 *
 * Una sola transacción
 * --------------------
 * Los 22 archivos van dentro de un único BEGIN/COMMIT: o quedan todos
 * aplicados o ninguno. Aplicar la mitad es exactamente el estado que este
 * script existe para evitar. Se verificó que ningún script contiene
 * sentencias no transaccionables (CONCURRENTLY, VACUUM, CREATE DATABASE) ni
 * maneja su propia transacción.
 *
 * Idempotencia
 * ------------
 * Los scripts ya estaban escritos para re-ejecutarse (`drop policy if
 * exists`, `create or replace function`, `add constraint` con captura de
 * `duplicate_object`, `cron.unschedule` antes de `cron.schedule`), así que
 * volver a correrlos sobre una base al día no cambia nada. El único DELETE
 * del lote vive dentro del cuerpo de `private.limpiar_usuarios_no_verificados()`
 * (010) y solo lo dispara el cron, no la aplicación del script.
 *
 * Sale con código 1 si algo falla, para usarse como gate de CI.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

// .env.local no existe en CI, donde las variables llegan del entorno.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const DIRECTORIO = join("supabase", "sql");
/** Para imprimir: join() usa "\\" en Windows y se ve mezclado con el resto. */
const DIRECTORIO_VISIBLE = "supabase/sql";
const SOLO_VERIFICAR = process.argv.includes("--check");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("\n❌ Falta DATABASE_URL (en .env.local o en el entorno).\n");
  process.exit(1);
}

/** Los scripts se aplican por su prefijo numérico, no por orden alfabético. */
function scriptsEnOrden(): { nombre: string; orden: number; sql: string }[] {
  const archivos = readdirSync(DIRECTORIO).filter((n) => n.endsWith(".sql"));

  if (archivos.length === 0) {
    console.error(`\n❌ No hay ningún .sql en ${DIRECTORIO_VISIBLE}/.\n`);
    process.exit(1);
  }

  return archivos
    .map((nombre) => {
      const prefijo = /^(\d{3})_/.exec(nombre);
      if (!prefijo) {
        console.error(
          `\n❌ ${nombre} no sigue el formato NNN_descripcion.sql.` +
            `\n   El orden de aplicación depende de ese prefijo, así que un archivo` +
            `\n   sin él no se puede ubicar en la secuencia. Renómbralo o sácalo` +
            `\n   de ${DIRECTORIO_VISIBLE}/.\n`,
        );
        process.exit(1);
      }
      return {
        nombre,
        orden: Number(prefijo[1]),
        sql: readFileSync(join(DIRECTORIO, nombre), "utf8"),
      };
    })
    .sort((a, b) => a.orden - b.orden);
}

/** Traduce el offset de carácter que reporta Postgres a un número de línea. */
function lineaDelError(sql: string, posicion: string | undefined): string {
  if (!posicion) return "";
  const offset = Number(posicion);
  if (!Number.isFinite(offset)) return "";
  const linea = sql.slice(0, offset - 1).split("\n").length;
  return `:${linea}`;
}

/** Oculta la contraseña: esta línea se imprime y puede acabar en un log de CI. */
function hostVisible(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return "(DATABASE_URL no es una URL válida)";
  }
}

async function main() {
  const scripts = scriptsEnOrden();

  console.log(`\n${SOLO_VERIFICAR ? "Verificando" : "Aplicando"} ${scripts.length} scripts de ${DIRECTORIO_VISIBLE}/`);
  console.log(`Base de datos: ${hostVisible(DATABASE_URL!)}`);
  if (SOLO_VERIFICAR) {
    console.log("Modo --check: se abre la transacción y se hace ROLLBACK, no se escribe nada.");
  }
  console.log("");

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
  } catch (error) {
    const e = error as { message?: string; code?: string };
    console.error(`❌ No pude conectar a la base: ${e.message ?? error}`);
    console.error(
      [
        "",
        "   Revisa DATABASE_URL. Contra Supabase se usa el Session pooler",
        "   (puerto 5432) y la cadena necesita `?sslmode=require`; el Direct",
        "   Connection solo resuelve por IPv6 y el Transaction pooler (6543)",
        "   no sirve para DDL. Ver supabase/sql/README.md.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  let aplicados = 0;
  try {
    await client.query("BEGIN");

    for (const { nombre, sql } of scripts) {
      try {
        await client.query(sql);
        aplicados += 1;
        console.log(`✅ ${nombre}`);
      } catch (error) {
        const e = error as { message?: string; position?: string; hint?: string };
        console.error(`❌ ${nombre}${lineaDelError(sql, e.position)} — ${e.message ?? error}`);
        if (e.hint) console.error(`   pista: ${e.hint}`);
        throw error;
      }
    }

    if (SOLO_VERIFICAR) {
      await client.query("ROLLBACK");
      console.log(`\n✅ Los ${scripts.length} scripts aplican limpio. Revertido, la base quedó intacta.\n`);
    } else {
      await client.query("COMMIT");
      console.log(`\n✅ ${scripts.length} scripts aplicados.`);
      console.log("   Siguiente paso: npm run test:rls\n");
    }
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    console.error(
      `\n❌ Falló en el script #${aplicados + 1} de ${scripts.length}.` +
        `\n   Se revirtió la transacción completa: la base quedó como estaba,` +
        `\n   sin ningún script a medio aplicar.\n`,
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
