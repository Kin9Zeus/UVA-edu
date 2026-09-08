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
 * Hasta ahora estos archivos se pegaban a mano en el SQL Editor de
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
 * Todos los archivos van dentro de un único BEGIN/COMMIT: o quedan todos
 * aplicados o ninguno. Aplicar la mitad es exactamente el estado que este
 * script existe para evitar. Se verificó que ningún script contiene
 * sentencias no transaccionables (CONCURRENTLY, VACUUM, CREATE DATABASE) ni
 * maneja su propia transacción.
 *
 * Idempotencia
 * ------------
 * Los scripts se re-ejecutan sin efecto (`drop policy if exists` antes de
 * cada `create policy`, `create or replace function`, `add constraint` con
 * captura de `duplicate_object`, `cron.unschedule` antes de
 * `cron.schedule`), así que volver a correrlos sobre una base al día no
 * cambia nada. No siempre fue así: `001` creaba sus 10 políticas sin el
 * `drop` previo y fallaba con «already exists» en la segunda corrida —
 * lo detectó `--check` la primera vez que se usó, antes de escribir nada.
 * Ese es el punto de `--check`: la idempotencia es una afirmación que hay
 * que verificar, no suponer. El único DELETE
 * del lote vive dentro del cuerpo de `private.limpiar_usuarios_no_verificados()`
 * (010) y solo lo dispara el cron, no la aplicación del script.
 *
 * Sale con código 1 si algo falla, para usarse como gate de CI.
 */

import { createHash } from "node:crypto";
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

/**
 * Dependencia declarada hacia una migración de Prisma (D-11).
 *
 * Los dos sistemas de migración del proyecto —Prisma para el esquema,
 * supabase/sql para RLS, funciones y vistas— no compartían ningún orden. Un
 * script que asume una columna creada por Prisma no tenía forma de decirlo:
 * el orden correcto vivía en comentarios sueltos ("Orden de aplicación:
 * DESPUÉS de 000-017") y en la cabeza de quien desplegaba.
 *
 * Con esta directiva la dependencia es verificable. Un script que la declare
 * y no la tenga cumplida falla con un mensaje que dice qué correr, en vez de
 * con «column "..." does not exist» a 900 líneas de distancia de la causa.
 *
 *   -- requiere-migracion: 20260908010000_leccion_introductoria_materializada
 */
const DIRECTIVA_MIGRACION = /^--\s*requiere-migracion:\s*(\S+)\s*$/m;

function migracionRequerida(sql: string): string | null {
  return DIRECTIVA_MIGRACION.exec(sql)?.[1] ?? null;
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

/**
 * Registro de lo aplicado (D-11, AUDIT-2026-09-08-base-de-datos.md).
 *
 * Hasta ahora este script EJECUTABA los archivos pero no dejaba constancia de
 * cuáles. Eso hacía imposible responder la pregunta que importa después de un
 * incidente: «este proyecto restaurado, ¿tiene las 80 policies del repo o las
 * de hace tres meses?». `supabase_migrations.schema_migrations` no sirve —
 * tiene 2 filas y ninguna representa este pipeline— y `_prisma_migrations`
 * solo cubre el esquema.
 *
 * Se guarda también el sha256 del contenido: sin él, el registro diría que
 * `074` se aplicó pero no CUÁL 074. Un archivo editado después de aplicarse
 * es exactamente el drift que esto existe para detectar.
 *
 * Vive en `private` para que no lo exponga PostgREST, y con RLS activado sin
 * ninguna policy: ni `anon` ni `authenticated` lo ven, solo `service_role` y
 * el propio pipeline. Mismo criterio que las tablas de rate limit.
 */
const DDL_REGISTRO = `
  create schema if not exists private;

  create table if not exists private.rls_aplicados (
    nombre      text primary key,
    orden       integer not null,
    sha256      text not null,
    aplicado_en timestamptz not null default now()
  );

  alter table private.rls_aplicados enable row level security;
`;

function sha256(contenido: string): string {
  return createHash("sha256").update(contenido, "utf8").digest("hex");
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

    // Dentro de la misma transacción que los scripts: si el lote se revierte,
    // el registro se revierte con él y nunca afirma algo que no pasó.
    await client.query(DDL_REGISTRO);

    // Las dependencias declaradas se comprueban TODAS antes de aplicar nada:
    // más vale un mensaje claro al principio que un fallo de sintaxis a mitad
    // del lote, aunque la transacción lo revierta igual.
    const requeridas = scripts
      .map((s) => ({ nombre: s.nombre, migracion: migracionRequerida(s.sql) }))
      .filter((s): s is { nombre: string; migracion: string } => s.migracion !== null);

    if (requeridas.length > 0) {
      const { rows: aplicadasEnPrisma } = await client.query<{ migration_name: string }>(
        `select migration_name from public._prisma_migrations where finished_at is not null`,
      );
      const nombresPrisma = new Set(aplicadasEnPrisma.map((f) => f.migration_name));
      const faltantes = requeridas.filter((r) => !nombresPrisma.has(r.migracion));

      if (faltantes.length > 0) {
        console.error("\n❌ Faltan migraciones de Prisma que estos scripts necesitan:\n");
        for (const { nombre, migracion } of faltantes) {
          console.error(`   ${nombre} requiere ${migracion}`);
        }
        console.error("\n   Corre `npm run prisma:deploy` primero.\n");
        throw new Error("Dependencias de migración sin cumplir.");
      }
    }

    for (const { nombre, orden, sql } of scripts) {
      try {
        await client.query(sql);
        await client.query(
          `insert into private.rls_aplicados (nombre, orden, sha256, aplicado_en)
           values ($1, $2, $3, now())
           on conflict (nombre) do update
             set orden = excluded.orden,
                 sha256 = excluded.sha256,
                 aplicado_en = excluded.aplicado_en`,
          [nombre, orden, sha256(sql)],
        );
        aplicados += 1;
        console.log(`✅ ${nombre}`);
      } catch (error) {
        const e = error as { message?: string; position?: string; hint?: string };
        console.error(`❌ ${nombre}${lineaDelError(sql, e.position)} — ${e.message ?? error}`);
        if (e.hint) console.error(`   pista: ${e.hint}`);
        throw error;
      }
    }

    // Archivos que la base recuerda y el repositorio ya no tiene. No es un
    // error —un script puede haberse renombrado o consolidado— pero sí algo
    // que nadie debería descubrir por casualidad: lo que ese script creó
    // sigue vivo en la base sin nada versionado que lo describa.
    const { rows: huerfanos } = await client.query<{ nombre: string }>(
      `select nombre from private.rls_aplicados
        where nombre <> all($1::text[])
        order by orden`,
      [scripts.map((s) => s.nombre)],
    );
    if (huerfanos.length > 0) {
      console.log(
        `\n⚠️  ${huerfanos.length} script(s) figuran aplicados en la base pero ya no están en ${DIRECTORIO_VISIBLE}/:`,
      );
      for (const { nombre } of huerfanos) console.log(`   - ${nombre}`);
      console.log("   Lo que crearon sigue en la base. Revisa si es intencional.");
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
