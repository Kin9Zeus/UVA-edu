/**
 * ============================================================================
 * ⚠️  BORRADO TOTAL — LEE ESTO ANTES DE EJECUTAR
 * ============================================================================
 *
 * Vacía TODAS las tablas de la base, borra TODOS los usuarios de Supabase Auth
 * y vacía los buckets de Storage. No respeta dominios de prueba, IDs fijos ni
 * nada: es un borrón y cuenta nueva.
 *
 * Es un script APARTE del seed a propósito. `prisma/seed.ts` limpia solo lo
 * que él mismo creó (los @uva.test y sus UUID fijos) y eso está bien: es la
 * operación que se corre a diario. Este otro destruye trabajo real, y mezclarlo
 * con "sembrar datos de prueba" haría que un `npm run db:seed` distraído
 * borrara la plataforma entera. Se separan porque son decisiones distintas.
 *
 * ── Salvaguardas ───────────────────────────────────────────────────────────
 * Este proyecto usa UN SOLO proyecto de Supabase para desarrollo y producción,
 * así que no existe ninguna pista en la URL que permita distinguirlos. La
 * única protección real es que la intención se declare dos veces:
 *
 *   1. ALLOW_DB_RESET debe valer exactamente "true". Deliberadamente NO se
 *      define en .env.local: hay que escribirla a mano en cada ejecución.
 *   2. --confirmar=<ref> debe coincidir carácter por carácter con el ref del
 *      proyecto de Supabase. Copiarlo y pegarlo obliga a mirar a qué proyecto
 *      se está apuntando; un `--confirmar=si` no sirve.
 *
 *      Se confirma el ref y NO el host de DATABASE_URL a propósito: con el
 *      pooler, ese host es `aws-0-<region>.pooler.supabase.com` — el mismo
 *      para todos los proyectos de la región. Confirmarlo no distingue esta
 *      base de la de cualquier otro. El ref (el subdominio de
 *      NEXT_PUBLIC_SUPABASE_URL) sí es único por proyecto.
 *
 * Además aborta si NODE_ENV === "production".
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *   npm run db:reset -- --dry-run         # NO borra: solo lista qué borraría
 *   npm run db:reset -- --confirmar=<ref> # borra de verdad (+ ALLOW_DB_RESET)
 *
 *   PowerShell:  $env:ALLOW_DB_RESET="true"; npm run db:reset -- --confirmar=abcdefghijk
 *   bash:        ALLOW_DB_RESET=true npm run db:reset -- --confirmar=abcdefghijk
 *
 * `--dry-run` no exige ninguna de las dos salvaguardas: no escribe nada, y
 * pedirle ceremonia a una operación de solo lectura solo lograría que la gente
 * se saltara el paso de revisar.
 *
 * ── Qué borra ──────────────────────────────────────────────────────────────
 *   1. Todas las tablas de los esquemas `public` y `private`, descubiertas en
 *      tiempo de ejecución con una consulta al catálogo de Postgres — NO con
 *      una lista escrita a mano. Una lista fija se desactualiza en silencio:
 *      es exactamente lo que le pasó a `limpiar()` del seed, que nunca se
 *      enteró de `mux_assets_pendientes_eliminacion` ni de
 *      `tokens_vista_previa` y las dejaba acumulando filas huérfanas.
 *   2. Todos los usuarios de `auth.users` vía la Admin API (incluida la tuya).
 *   3. Todos los archivos de los buckets de Storage.
 *
 * ── Qué NO borra ───────────────────────────────────────────────────────────
 *   - `_prisma_migrations`: truncarla le haría creer a Prisma que ninguna
 *     migración se aplicó nunca, y el siguiente `prisma migrate deploy`
 *     intentaría recrear tablas que ya existen. El esquema se conserva; lo que
 *     se va son los datos.
 *   - Los buckets en sí (solo su contenido), las políticas RLS, funciones,
 *     triggers, vistas y extensiones. Todo eso vive en `supabase/sql/` y se
 *     reaplica con `npm run db:rls` si hiciera falta.
 *
 * Sale con código 1 si algo falla.
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

// .env.local no existe en CI, donde las variables llegan del entorno.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const SOLO_LISTAR = process.argv.includes("--dry-run");
const CONFIRMACION = process.argv
  .find((arg) => arg.startsWith("--confirmar="))
  ?.slice("--confirmar=".length);

const ESQUEMAS = ["public", "private"];

/**
 * Prisma registra aquí qué migraciones aplicó. Truncarla no borra ninguna
 * tabla, pero deja el historial en blanco y rompe el siguiente deploy.
 */
const TABLAS_INTOCABLES = new Set(["_prisma_migrations"]);

/** Definidos en supabase/sql/011 y 012. El bucket se conserva; su contenido no. */
const BUCKETS = ["materiales-lecciones", "portadas-cursos"];

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// Salvaguardas
// ---------------------------------------------------------------------------

/** Oculta la contraseña: esta línea se imprime y puede acabar en un log. */
function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(URL no válida)";
  }
}

/**
 * El ref del proyecto: el subdominio de https://<ref>.supabase.co. Es el único
 * identificador que distingue un proyecto de otro (ver salvaguarda 2 arriba).
 */
function refDelProyecto(url: string): string {
  const host = hostDe(url);
  const ref = host.split(".")[0];
  if (!ref || !host.endsWith(".supabase.co")) {
    abortar(
      `NEXT_PUBLIC_SUPABASE_URL no tiene la forma https://<ref>.supabase.co (es "${host}").` +
        "\n   Sin un ref no hay forma de confirmar a qué proyecto se apunta.",
    );
  }
  return ref;
}

function abortar(mensaje: string): never {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

function verificarEntorno(): void {
  const faltantes = [
    ["DATABASE_URL", DATABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
  ]
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);

  if (faltantes.length > 0) {
    abortar(`Faltan variables de entorno en .env.local: ${faltantes.join(", ")}`);
  }

  // En --dry-run no se pide nada más: no escribe, y ponerle trámites a una
  // lectura solo consigue que nadie la use antes de borrar.
  if (SOLO_LISTAR) return;

  if (process.env.NODE_ENV === "production") {
    abortar("NODE_ENV=production. Abortado.");
  }

  if (process.env.ALLOW_DB_RESET !== "true") {
    abortar(
      [
        "ALLOW_DB_RESET no está definida — no se tocó nada.",
        "",
        "   Este script BORRA TODO: tablas, usuarios de Auth y archivos.",
        "   Corre primero `npm run db:reset -- --dry-run` para ver qué se llevaría.",
        "",
        '   PowerShell:  $env:ALLOW_DB_RESET="true"; npm run db:reset -- --confirmar=<ref>',
        "   bash:        ALLOW_DB_RESET=true npm run db:reset -- --confirmar=<ref>",
      ].join("\n"),
    );
  }

  const ref = refDelProyecto(SUPABASE_URL!);
  if (!CONFIRMACION) {
    abortar(
      [
        "Falta --confirmar=<ref>.",
        "",
        `   El proyecto de Supabase al que apuntas es:  ${ref}`,
        "",
        "   Vuelve a correrlo agregando exactamente ese ref:",
        `   npm run db:reset -- --confirmar=${ref}`,
      ].join("\n"),
    );
  }

  if (CONFIRMACION !== ref) {
    abortar(
      [
        "El ref de --confirmar no coincide con NEXT_PUBLIC_SUPABASE_URL.",
        "",
        `   Escribiste:    ${CONFIRMACION}`,
        `   El proyecto es: ${ref}`,
        "",
        "   Si esperabas otro proyecto, revisa .env.local antes de insistir.",
      ].join("\n"),
    );
  }
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

type Tabla = { esquema: string; nombre: string; filas: number };

/**
 * Descubre las tablas ordinarias (`relkind = 'r'`) de los esquemas que nos
 * interesan. Se excluyen vistas y vistas materializadas — no guardan datos
 * propios y truncarlas es un error — y las tablas intocables.
 */
async function inventariarTablas(client: Client): Promise<Tabla[]> {
  const { rows } = await client.query<{ esquema: string; nombre: string }>(
    `select n.nspname as esquema, c.relname as nombre
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any($1)
        and c.relkind = 'r'
      order by n.nspname, c.relname`,
    [ESQUEMAS],
  );

  const tablas: Tabla[] = [];
  for (const { esquema, nombre } of rows) {
    if (TABLAS_INTOCABLES.has(nombre)) continue;
    // Vienen del catálogo, pero se citan igual: una tabla puede llamarse con
    // mayúsculas o con una palabra reservada y romper el SQL sin comillas.
    const { rows: conteo } = await client.query<{ n: string }>(
      `select count(*)::text as n from "${esquema}"."${nombre}"`,
    );
    tablas.push({ esquema, nombre, filas: Number(conteo[0].n) });
  }
  return tablas;
}

const supabase =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function listarUsuariosAuth(): Promise<{ id: string; email?: string }[]> {
  const todos: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase!.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`No se pudo listar auth.users: ${error.message}`);
    todos.push(...data.users);
    if (data.users.length < 200) break;
  }
  return todos;
}

/**
 * Storage lista por prefijo, no recursivamente: una entrada sin `id` es una
 * carpeta y hay que bajar. Devuelve rutas completas listas para `remove()`.
 */
async function listarArchivos(bucket: string, prefijo = ""): Promise<string[]> {
  const { data, error } = await supabase!.storage.from(bucket).list(prefijo, { limit: 1000 });
  if (error) throw new Error(`No se pudo listar ${bucket}/${prefijo}: ${error.message}`);

  const rutas: string[] = [];
  for (const entrada of data ?? []) {
    const ruta = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (entrada.id === null) {
      rutas.push(...(await listarArchivos(bucket, ruta)));
    } else {
      rutas.push(ruta);
    }
  }
  return rutas;
}

// ---------------------------------------------------------------------------
// Borrado
// ---------------------------------------------------------------------------

/** deadlock_detected y lock_not_available: transitorios, vale la pena reintentar. */
const CODIGOS_REINTENTABLES = new Set(["40P01", "55P03"]);
const INTENTOS_TRUNCATE = 5;

/**
 * Un solo TRUNCATE con todas las tablas: Postgres resuelve el orden de las
 * Foreign Keys por su cuenta, algo que una secuencia de DELETE obligaría a
 * mantener a mano (y a re-ordenar cada vez que alguien agrega una FK).
 * CASCADE cubre cualquier tabla referenciante que no estuviera en la lista;
 * RESTART IDENTITY deja las secuencias como en una base recién creada.
 *
 * Por qué reintenta
 * -----------------
 * TRUNCATE necesita ACCESS EXCLUSIVE sobre cada tabla, y ese lock choca con
 * el ACCESS SHARE que toma cualquier SELECT. Contra Supabase siempre hay
 * lectores vivos — PostgREST atiende la API REST de forma permanente, y el
 * `next dev` de quien corre esto suma los suyos — así que dos sesiones
 * pueden pedir los mismos locks en orden distinto y Postgres mata a una con
 * deadlock_detected (40P01). No es un error del borrado: es contención, y
 * desaparece al volver a intentarlo.
 *
 * `lock_timeout` acota cada intento: sin él, un lector largo deja el script
 * colgado sin decir nada en vez de fallar y reintentar. Se pone con SET
 * LOCAL para que valga solo dentro de esta transacción.
 */
async function truncarTablas(client: Client, tablas: Tabla[]): Promise<void> {
  if (tablas.length === 0) return;
  const lista = tablas.map((t) => `"${t.esquema}"."${t.nombre}"`).join(", ");

  for (let intento = 1; intento <= INTENTOS_TRUNCATE; intento += 1) {
    await client.query("begin");
    try {
      await client.query("set local lock_timeout = '10s'");
      await client.query(`truncate table ${lista} restart identity cascade`);
      await client.query("commit");
      return;
    } catch (error) {
      await client.query("rollback");

      const codigo = (error as { code?: string }).code;
      if (!codigo || !CODIGOS_REINTENTABLES.has(codigo) || intento === INTENTOS_TRUNCATE) {
        throw error;
      }

      // Espera creciente: le da tiempo a la consulta que tenía el lock a
      // terminar, en vez de volver a chocar de inmediato con ella.
      const espera = 1000 * intento;
      console.log(
        `   … contención de locks (${codigo}), intento ${intento}/${INTENTOS_TRUNCATE}. ` +
          `Reintentando en ${espera / 1000}s`,
      );
      await new Promise((resolver) => setTimeout(resolver, espera));
    }
  }
}

async function borrarUsuariosAuth(usuarios: { id: string; email?: string }[]): Promise<number> {
  let borrados = 0;
  for (const usuario of usuarios) {
    const { error } = await supabase!.auth.admin.deleteUser(usuario.id);
    if (error) throw new Error(`No se pudo borrar ${usuario.email ?? usuario.id}: ${error.message}`);
    borrados++;
  }
  return borrados;
}

async function vaciarBucket(bucket: string, rutas: string[]): Promise<void> {
  // `remove()` acepta lotes; se parte en tandas para no armar una petición
  // gigante en un bucket con muchos archivos.
  for (let i = 0; i < rutas.length; i += 100) {
    const { error } = await supabase!.storage.from(bucket).remove(rutas.slice(i, i + 100));
    if (error) throw new Error(`No se pudo vaciar ${bucket}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  verificarEntorno();

  const ref = refDelProyecto(SUPABASE_URL!);
  console.log(`\n${SOLO_LISTAR ? "🔍 Inventario (--dry-run: no se borra nada)" : "🔥 BORRADO TOTAL"}`);
  console.log(`   Proyecto Supabase: ${ref}`);
  console.log(`   Conexión Postgres: ${hostDe(DATABASE_URL!)}\n`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const tablas = await inventariarTablas(client);
    const usuarios = await listarUsuariosAuth();
    const archivos = new Map<string, string[]>();
    for (const bucket of BUCKETS) {
      archivos.set(bucket, await listarArchivos(bucket));
    }

    const totalFilas = tablas.reduce((suma, t) => suma + t.filas, 0);
    const conDatos = tablas.filter((t) => t.filas > 0);

    console.log(
      `📊 Tablas: ${tablas.length} (${conDatos.length} con datos, ${totalFilas} filas en total)`,
    );
    for (const tabla of tablas) {
      const etiqueta = `${tabla.esquema}.${tabla.nombre}`.padEnd(46, " ");
      console.log(
        `   ${tabla.filas > 0 ? "•" : " "} ${etiqueta}${String(tabla.filas).padStart(6, " ")}`,
      );
    }

    console.log(`\n👤 Usuarios de Auth: ${usuarios.length}`);
    for (const usuario of usuarios) {
      console.log(`   • ${usuario.email ?? "(sin correo)"}`);
    }

    const totalArchivos = [...archivos.values()].reduce((suma, r) => suma + r.length, 0);
    console.log(`\n📁 Archivos en Storage: ${totalArchivos}`);
    for (const [bucket, rutas] of archivos) {
      console.log(`   ${bucket}: ${rutas.length}`);
      for (const ruta of rutas.slice(0, 10)) console.log(`      • ${ruta}`);
      if (rutas.length > 10) console.log(`      … y ${rutas.length - 10} más`);
    }

    console.log(
      `\n🔒 Se conservan: ${[...TABLAS_INTOCABLES].join(", ")}, los buckets, y todo el esquema`,
    );
    console.log("   (políticas RLS, funciones, triggers, vistas). Solo se van los datos.");

    if (SOLO_LISTAR) {
      console.log(
        [
          "",
          "Nada fue borrado. Para hacerlo de verdad:",
          "",
          `   PowerShell:  $env:ALLOW_DB_RESET="true"; npm run db:reset -- --confirmar=${ref}`,
          `   bash:        ALLOW_DB_RESET=true npm run db:reset -- --confirmar=${ref}`,
          "",
        ].join("\n"),
      );
      return;
    }

    console.log("\n🧨 Borrando…");

    // Las tablas van primero: `perfiles.id` tiene una FK a `auth.users(id)`
    // con ON DELETE CASCADE (010_fk_perfiles_cascade_y_limpieza.sql), así que
    // borrar los usuarios antes dispararía ese cascade sobre una tabla que de
    // todos modos se va a truncar — trabajo doble y más lento.
    await truncarTablas(client, tablas);
    console.log(`   ✓ ${tablas.length} tablas truncadas (${totalFilas} filas)`);

    const borrados = await borrarUsuariosAuth(usuarios);
    console.log(`   ✓ ${borrados} usuarios de Auth borrados`);

    for (const [bucket, rutas] of archivos) {
      if (rutas.length === 0) continue;
      await vaciarBucket(bucket, rutas);
      console.log(`   ✓ ${bucket}: ${rutas.length} archivos borrados`);
    }

    console.log(
      [
        "",
        "✅ Base vacía. Siguiente paso:",
        "",
        "   npm run prisma:deploy   # aplica migraciones pendientes",
        "   npm run db:rls          # reaplica políticas, funciones y triggers",
        "   npm run db:seed         # siembra los datos de prueba",
        "",
      ].join("\n"),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);

  // El TRUNCATE va dentro de una transacción con ROLLBACK, así que un fallo
  // por locks no deja la base a medio borrar. Decirlo ahorra la duda.
  const codigo = (error as { code?: string }).code;
  if (codigo && CODIGOS_REINTENTABLES.has(codigo)) {
    console.error(
      [
        "   Es contención de locks, no un fallo del borrado: la transacción hizo",
        "   ROLLBACK y no se borró nada. Detén lo que esté consultando la base",
        "   (sobre todo `npm run dev`) y vuelve a intentarlo.",
        "",
      ].join("\n"),
    );
  }
  process.exit(1);
});
