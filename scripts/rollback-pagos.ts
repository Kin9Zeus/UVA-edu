/**
 * Deshace POR COMPLETO el trabajo de la rama `pagos` del lado de la base de
 * datos: tabla `intentos_pago`, sus funciones y todo dato de prueba de Wompi.
 *
 * Uso:
 *   npm run pagos:rollback           -- muestra qué se borraría y NO borra
 *   npm run pagos:rollback -- --si   -- ejecuta de verdad
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ ESTE ARCHIVO ES TEMPORAL. Se borra —junto con su entrada en          │
 * │ package.json— cuando se confirme que la pasarela se queda.           │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Por qué existe
 * --------------
 * La funcionalidad de pagos es tentativa: si se decide descartarla, borrar la
 * rama elimina el código pero NO revierte lo que ya se aplicó en Supabase.
 * Como el proyecto tiene UNA SOLA base —`DATABASE_URL` y
 * `NEXT_PUBLIC_SUPABASE_URL` apuntan al mismo proyecto, no hay staging— esa
 * tabla convive con los datos reales de producción. Este script es la única
 * forma de volver atrás sin tocar nada más.
 *
 * Por qué es un script y no un .sql
 * ---------------------------------
 * No puede vivir en `supabase/sql/`: `scripts/apply-rls.ts` aplica ESA CARPETA
 * ENTERA en cada `npm run db:rls`, así que un `102_rollback.sql` borraría la
 * tabla en cada corrida. Y tampoco puede ser una migración de Prisma: llevaría
 * un DROP TABLE, y `npm run verificar:migraciones-reversibles` (job `checks`
 * de ci.yml) falla ante un DROP nuevo — la regla de
 * docs/ops/plan-de-reversion.md.
 *
 * La guarda que importa
 * ---------------------
 * `proveedor = 'wompi'` NO alcanza como filtro, y eso se descubrió probando
 * este script antes de aplicar nada: la base ya tenía una suscripción de
 * Wompi —`sub_seed_vencida`, que crea prisma/seed.ts:1046— que este rollback
 * habría borrado sin tener nada que ver con ella.
 *
 * Así que el filtro real es la TRAZABILIDAD: solo se borra lo que nació del
 * checkout nuevo, resuelto por el camino
 *
 *     intentos_pago.id_transaccion_wompi
 *       -> pagos.ref_transaccion_externa
 *       -> pagos.id_suscripcion
 *
 * Una suscripción de Wompi que no llegue por ese camino (el seed, o un dato
 * cargado a mano) queda intacta. Por eso el orden importa: las filas objetivo
 * se resuelven ANTES de borrar `intentos_pago`, que es quien las identifica.
 *
 * Las suscripciones reales de hoy —'invitacion' y 'manual'— quedan fuera dos
 * veces: por proveedor y por trazabilidad.
 *
 * Qué NO hace
 * -----------
 * Borrar los archivos del repo. Eso va a mano, y el script los lista al final.
 */

import { Client } from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("\n❌ Falta DATABASE_URL (en .env.local o en el entorno).\n");
  process.exit(1);
}

const EJECUTAR = process.argv.includes("--si");
/** Las migraciones que introdujo esta rama, en orden de aplicación. */
const MIGRACIONES = [
  "20260914120000_intentos_pago",
  "20260914180000_aviso_vencimiento",
];

/**
 * Las suscripciones que ESTA rama creó: las que se pueden rastrear hasta un
 * `intentos_pago`. Se usa igual en el conteo previo y en el borrado, para que
 * lo que se muestra y lo que se borra no puedan separarse.
 *
 * `to_regclass` devuelve null si la tabla no existe, así que la consulta
 * funciona también cuando el rollback ya corrió antes (es idempotente).
 */
const SUSCRIPCIONES_DE_ESTA_RAMA = `
  select distinct s.id
  from public.suscripciones s
  join public.pagos p        on p.id_suscripcion = s.id
  join public.intentos_pago i on i.id_transaccion_wompi = p.ref_transaccion_externa
  where s.proveedor = 'wompi'
`;

/** Lo que se va a borrar, con el conteo previo para poder mirarlo antes. */
const CONTEOS: { etiqueta: string; sql: string }[] = [
  {
    etiqueta: "suscripciones creadas por el checkout nuevo",
    sql: `select count(*)::int as n from (${SUSCRIPCIONES_DE_ESTA_RAMA}) t`,
  },
  {
    etiqueta: "pagos de esas suscripciones",
    sql: `select count(*)::int as n from public.pagos
          where id_suscripcion in (${SUSCRIPCIONES_DE_ESTA_RAMA})`,
  },
  {
    etiqueta: "eventos de webhook de Wompi",
    sql: `select count(*)::int as n from public.eventos_webhook where proveedor = 'wompi'`,
  },
  {
    etiqueta: "intentos de pago",
    sql: `select count(*)::int as n from public.intentos_pago`,
  },
  {
    etiqueta: "cupones con usos por revertir",
    sql: `select count(*)::int as n from public.cupones c
          where exists (
            select 1 from public.suscripciones s
            where s.id_cupon = c.id and s.id in (${SUSCRIPCIONES_DE_ESTA_RAMA})
          )`,
  },
  {
    etiqueta: "[se conservan] suscripciones de Wompi ajenas a esta rama",
    sql: `select count(*)::int as n from public.suscripciones
          where proveedor = 'wompi' and id not in (${SUSCRIPCIONES_DE_ESTA_RAMA})`,
  },
];

/**
 * El orden importa por partida doble:
 *   - `pagos` referencia `suscripciones`, así que se borra de la hoja a la raíz;
 *   - y las filas objetivo se CONGELAN en una tabla temporal al principio,
 *     porque `intentos_pago` —que es quien las identifica— desaparece a mitad
 *     de camino.
 */
const PASOS: { etiqueta: string; sql: string }[] = [
  {
    etiqueta: "Resolver qué suscripciones creó esta rama",
    sql: `create temp table _rb_objetivo on commit drop as
          ${SUSCRIPCIONES_DE_ESTA_RAMA}`,
  },
  {
    etiqueta: "Revertir veces_usado de los cupones consumidos en pruebas",
    sql: `update public.cupones c
          set veces_usado = greatest(0, c.veces_usado - (
            select count(*) from public.suscripciones s
            where s.id_cupon = c.id and s.id in (select id from _rb_objetivo)
          ))
          where exists (
            select 1 from public.suscripciones s
            where s.id_cupon = c.id and s.id in (select id from _rb_objetivo)
          )`,
  },
  {
    etiqueta: "Borrar los pagos de esas suscripciones",
    sql: `delete from public.pagos where id_suscripcion in (select id from _rb_objetivo)`,
  },
  {
    etiqueta: "Borrar esas suscripciones (el seed queda intacto)",
    sql: `delete from public.suscripciones where id in (select id from _rb_objetivo)`,
  },
  {
    // Aquí sí vale `proveedor = 'wompi'` a secas: nunca hubo integración con
    // Wompi antes de esta rama, así que todo evento de Wompi registrado es de
    // las pruebas. El seed no escribe en `eventos_webhook`.
    etiqueta: "Borrar eventos de webhook de Wompi",
    sql: `delete from public.eventos_webhook where proveedor = 'wompi'`,
  },
  {
    etiqueta: "Eliminar funciones (101)",
    sql: `drop function if exists public.aplicar_pago_wompi(text, text, timestamptz, bigint, text);
          drop function if exists public.rechazar_intento_pago(text, text);`,
  },
  {
    etiqueta: "Eliminar políticas de intentos_pago (100)",
    sql: `drop policy if exists "intentos_pago_select_propio" on public.intentos_pago;
          drop policy if exists "intentos_pago_admin_gestiona" on public.intentos_pago;`,
  },
  {
    etiqueta: "Eliminar la tabla intentos_pago",
    sql: `drop table if exists public.intentos_pago`,
  },
  {
    // Columna que agregó la fase de correos. Va ANTES de desregistrar las
    // migraciones, y es la única parte del rollback que toca una tabla
    // preexistente: `suscripciones`. Por eso se elimina solo la columna que
    // creó esta rama, nunca la tabla.
    etiqueta: "Quitar suscripciones.aviso_vencimiento_en",
    sql: `alter table public.suscripciones drop column if exists aviso_vencimiento_en`,
  },
  {
    // El paso que se olvida: sin esto Prisma cree que las migraciones siguen
    // aplicadas y `migrate deploy` no las volvería a correr si se retoma.
    etiqueta: "Desregistrar las migraciones en _prisma_migrations",
    sql: `delete from "_prisma_migrations" where migration_name in (${MIGRACIONES.map(
      (m) => `'${m}'`,
    ).join(", ")})`,
  },
];

const ARCHIVOS_A_BORRAR_A_MANO = [
  "prisma/migrations/20260914120000_intentos_pago/",
  "prisma/migrations/20260914180000_aviso_vencimiento/",
  "src/emails/recibo-pago.tsx y src/emails/vencimiento-proximo.tsx",
  "scripts/pagos-avisar-vencimientos.ts y scripts/pagos-e2e-test.ts",
  "enviarCorreoReciboPago en src/lib/resend.ts",
  "supabase/sql/098_intentos_pago.sql",
  "supabase/sql/099_aplicar_pago_wompi.sql",
  "scripts/rollback-pagos.ts  (este archivo)",
  "en prisma/schema.prisma: el modelo IntentosPago, sus 3 relaciones inversas",
  "en prisma/schema.prisma: el campo aviso_vencimiento_en de Suscripciones",
  "las variables WOMPI_* de .env.local",
];

async function main() {
  const cliente = new Client({ connectionString: DATABASE_URL });
  await cliente.connect();

  try {
    console.log(`\n${EJECUTAR ? "EJECUTANDO" : "SIMULACIÓN (no se borra nada)"}\n`);

    // Todo lo que hay que revertir en datos se identifica a través de
    // `intentos_pago`. Si la tabla no está, o la migración nunca se aplicó o
    // este rollback ya corrió: en ambos casos no queda nada que borrar y
    // seguir solo produciría errores de "relation does not exist".
    const { rows: existe } = await cliente.query<{ hay: boolean }>(
      `select to_regclass('public.intentos_pago') is not null as hay`,
    );

    if (!existe[0]?.hay) {
      console.log("La tabla `intentos_pago` no existe: no hay nada que revertir en la base.");
      console.log("(O la migración no se ha aplicado, o este rollback ya corrió.)\n");
      console.log("Si quedan archivos del trabajo, hay que borrarlos a mano:");
      for (const archivo of ARCHIVOS_A_BORRAR_A_MANO) console.log(`  - ${archivo}`);
      console.log("");
      return;
    }

    console.log("Lo que hay ahora mismo:");

    let total = 0;
    for (const { etiqueta, sql } of CONTEOS) {
      const { rows } = await cliente.query<{ n: number }>(sql);
      const n = rows[0]?.n ?? 0;
      // La última fila es informativa (lo que se CONSERVA), no se suma.
      if (!etiqueta.startsWith("[se conservan]")) total += n;
      console.log(`  ${String(n).padStart(5)}  ${etiqueta}`);
    }

    if (!EJECUTAR) {
      console.log(
        `\nTotal de filas que se borrarían: ${total}.` +
          "\nNo se tocan las suscripciones 'invitacion' ni 'manual', ni las de" +
          "\nWompi que no vengan del checkout nuevo (p. ej. las del seed)." +
          "\n\nPara ejecutar de verdad:\n  npm run pagos:rollback -- --si\n",
      );
      return;
    }

    // Todo en UNA transacción: o revierte entero, o no revierte nada. Mismo
    // criterio que scripts/apply-rls.ts.
    await cliente.query("begin");
    for (const { etiqueta, sql } of PASOS) {
      await cliente.query(sql);
      console.log(`  OK  ${etiqueta}`);
    }
    await cliente.query("commit");

    console.log("\n✅ Base de datos revertida.\n");
    console.log("Falta borrar a mano del repo:");
    for (const archivo of ARCHIVOS_A_BORRAR_A_MANO) {
      console.log(`  - ${archivo}`);
    }
    console.log("\nY luego:  git checkout master && git branch -D pagos\n");
  } catch (error) {
    await cliente.query("rollback").catch(() => {});
    console.error(`\n❌ Falló la reversión: ${error instanceof Error ? error.message : error}`);
    console.error("   No se aplicó ningún cambio (la transacción se revirtió).\n");
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
}

void main();
