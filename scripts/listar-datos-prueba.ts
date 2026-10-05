/**
 * Listado de SOLO LECTURA de cuentas, cursos y accesos de prueba en la base a
 * la que apunta el entorno. No escribe nada: toda la corrida va en una
 * transacción `READ ONLY` que se revierte al final.
 *
 * Sirve para decidir qué borrar antes de agregar una entrada a LIMPIEZAS en
 * `scripts/limpiar-datos-prueba.ts`, y para revisar quién entró con las
 * cuentas del seed (`admin@uva.test` y compañía, ver prisma/seed.ts).
 *
 * Lista TODAS las cuentas, no solo las que parecen de prueba: hoy son pocas, y
 * la decisión de cuál es de prueba la toma una persona. La marca `prueba` es
 * una pista (dominio @uva.test / @test.com / @example.*, o "prueba"/"test" en
 * el correo), no un criterio de borrado.
 *
 * Además de la consola, deja el detalle completo en
 * `respaldos/listado-datos-prueba-<fecha>.json` (ignorado por git: lleva
 * correos e IPs).
 *
 * Uso:
 *   ENV_FILE=.env.produccion.local npm run db:listar-datos-prueba
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

type Fila = Record<string, unknown>;

const reporte: Record<string, unknown> = {};

function seccion(titulo: string): void {
  console.log(`\n=== ${titulo} ===`);
}

/** Una sección que puede fallar sin tumbar las demás (p. ej. auth.* cambia entre versiones). */
async function intentar(db: Client, nombre: string, fn: () => Promise<void>): Promise<void> {
  // Un error dentro de una transacción la deja abortada: cada sección va en su savepoint.
  await db.query("savepoint s");
  try {
    await fn();
    await db.query("release savepoint s");
  } catch (error) {
    await db.query("rollback to savepoint s");
    const mensaje = error instanceof Error ? error.message : String(error);
    console.log(`   ⚠️  No se pudo leer (${nombre}): ${mensaje}`);
    reporte[`${nombre}_error`] = mensaje;
  }
}

/** Para identificadores que vienen del catálogo de Postgres, nunca de entrada externa. */
const ident = (nombre: string): string => `"${nombre.replace(/"/g, '""')}"`;

/** Tablas y columnas que referencian `<tabla>(id)` con una FK de una sola columna. */
async function referencias(db: Client, tabla: string): Promise<{ tabla: string; columna: string; accion: string }[]> {
  const { rows } = await db.query(
    `select c.conrelid::regclass::text as tabla, a.attname as columna,
            case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
                               when 'c' then 'CASCADE' when 'n' then 'SET NULL' else c.confdeltype::text end as accion
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = $1::regclass and array_length(c.conkey, 1) = 1
      order by 1, 2`,
    [tabla],
  );
  return rows;
}

/** Cuántas filas de cada tabla dependiente apuntan a cada id dado. */
async function dependencias(db: Client, tabla: string, ids: string[]): Promise<Fila[]> {
  const salida: Fila[] = [];
  if (ids.length === 0) return salida;
  for (const ref of await referencias(db, tabla)) {
    const { rows } = await db.query(
      `select ${ident(ref.columna)}::text as id, count(*)::int as filas
         from ${ref.tabla} where ${ident(ref.columna)} = any($1::uuid[]) group by 1`,
      [ids],
    );
    for (const r of rows) salida.push({ tabla: ref.tabla, columna: ref.columna, al_borrar: ref.accion, id: r.id, filas: r.filas });
  }
  return salida;
}

async function main(): Promise<void> {
  const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL) {
    console.error("\n❌ Faltan DATABASE_URL o NEXT_PUBLIC_SUPABASE_URL.\n");
    process.exit(1);
  }
  const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  console.log(`\n🎯 Proyecto: ${ref}  (solo lectura)`);
  reporte.proyecto = ref;
  reporte.generado_en = new Date().toISOString();

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    await db.query("begin read only");

    // 1. Cuentas ------------------------------------------------------------
    let cuentas: Fila[] = [];
    seccion("Cuentas (auth.users + perfiles)");
    await intentar(db, "cuentas", async () => {
      const { rows } = await db.query(`
        select u.id::text as id, u.email, p.rol::text as rol, p.estado::text as estado,
               u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null as confirmado,
               u.raw_app_meta_data->>'provider' as proveedor,
               (u.email ~* '@(uva\\.test|test\\.com|example\\.(com|org|net)|mailinator\\.com)$'
                or u.email ~* '(prueba|test)') as prueba,
               p.anonimizado_en is not null as anonimizada
          from auth.users u left join public.perfiles p on p.id = u.id
         order by prueba desc, p.rol, u.email`);
      cuentas = rows;
      reporte.cuentas = rows;
      for (const c of rows) {
        const ultimo = c.last_sign_in_at ? new Date(c.last_sign_in_at as string).toISOString().slice(0, 16) : "nunca";
        console.log(`   ${c.prueba ? "🧪" : "  "} ${String(c.email).padEnd(36)} ${String(c.rol ?? "sin perfil").padEnd(14)} ${String(c.estado ?? "").padEnd(10)} último acceso: ${ultimo}`);
      }
      console.log(`   (${rows.length} cuentas; 🧪 = parece de prueba)`);

      const perfilesSinAuth = await db.query(
        `select p.id::text, p.correo, p.rol::text from public.perfiles p
          where not exists (select 1 from auth.users u where u.id = p.id)`,
      );
      if (perfilesSinAuth.rowCount) {
        reporte.perfiles_sin_auth = perfilesSinAuth.rows;
        console.log(`   Perfiles sin cuenta de Auth: ${perfilesSinAuth.rowCount}`);
        for (const r of perfilesSinAuth.rows) console.log(`      ${r.correo} (${r.rol})`);
      }
    });

    // 2. Administradores ----------------------------------------------------
    seccion("Administradores");
    const admins = cuentas.filter((c) => c.rol === "ADMINISTRADOR");
    for (const a of admins) console.log(`   ${a.prueba ? "🧪" : "✅"} ${a.email}`);
    const adminsReales = admins.filter((a) => !a.prueba);
    console.log(
      adminsReales.length === 0
        ? "   ⚠️  NO hay ningún administrador que no sea de prueba: crea el tuyo ANTES de borrar nada."
        : `   ${adminsReales.length} administrador(es) real(es): se puede borrar el de prueba.`,
    );
    reporte.administradores = admins;

    // 3. Qué cuelga de cada cuenta de prueba ---------------------------------
    const idsPrueba = cuentas.filter((c) => c.prueba).map((c) => String(c.id));
    const correoDe = new Map(cuentas.map((c) => [String(c.id), String(c.email)]));
    seccion("Qué cuelga de las cuentas de prueba (bloquea o arrastra el borrado)");
    await intentar(db, "dependencias_cuentas", async () => {
      const deps = await dependencias(db, "public.perfiles", idsPrueba);
      reporte.dependencias_cuentas = deps;
      if (deps.length === 0) console.log("   Nada: se pueden borrar sin tocar otras tablas.");
      for (const d of deps) {
        console.log(`   ${String(correoDe.get(String(d.id))).padEnd(32)} ${String(d.tabla).padEnd(34)} ${String(d.columna).padEnd(18)} ${String(d.filas).padStart(4)} filas · al borrar: ${d.al_borrar}`);
      }
    });

    // 4. Cursos --------------------------------------------------------------
    seccion("Cursos");
    let cursosSospechosos: string[] = [];
    await intentar(db, "cursos", async () => {
      const { rows } = await db.query(`
        select c.id::text as id, c.titulo, c.slug, c.mostrado, c.creado_en,
               u.email as creado_por,
               (select count(*)::int from public.modulos m where m.id_curso = c.id) as modulos,
               (select count(*)::int from public.lecciones l join public.modulos m on m.id = l.id_modulo
                 where m.id_curso = c.id) as lecciones,
               (c.titulo ~* '(prueba|test)' or c.slug ~* '(prueba|test)') as prueba
          from public.cursos c left join auth.users u on u.id = c.id_admin_creador
         order by c.creado_en`);
      reporte.cursos = rows;
      for (const c of rows) {
        const marca = c.prueba || c.lecciones === 0 ? "🧪" : "  ";
        console.log(`   ${marca} ${String(c.titulo).slice(0, 44).padEnd(44)} ${c.mostrado ? "publicado" : "oculto   "} ${String(c.lecciones).padStart(3)} clases · creado por ${c.creado_por}`);
      }
      console.log("   (🧪 = nombre de prueba o sin clases)");
      cursosSospechosos = rows.filter((c) => c.prueba || c.lecciones === 0).map((c) => String(c.id));
    });

    seccion("Qué cuelga de los cursos sospechosos");
    await intentar(db, "dependencias_cursos", async () => {
      const deps = await dependencias(db, "public.cursos", cursosSospechosos);
      reporte.dependencias_cursos = deps;
      if (deps.length === 0) console.log("   Nada.");
      for (const d of deps) {
        console.log(`   ${String(d.id).slice(0, 8)}…  ${String(d.tabla).padEnd(34)} ${String(d.filas).padStart(4)} filas · al borrar: ${d.al_borrar}`);
      }
    });

    // 5. Catálogo que rodea a los cursos ------------------------------------
    seccion("Categorías (con cuántos cursos las usan)");
    await intentar(db, "categorias", async () => {
      const { rows } = await db.query(`
        select k.id::text as id, k.nombre, k.activo,
               (select count(*)::int from public.curso_categorias cc where cc.id_categoria = k.id) as cursos
          from public.categorias k order by k.nombre`);
      reporte.categorias = rows;
      for (const k of rows) console.log(`   ${String(k.nombre).padEnd(36)} ${k.activo ? "activa  " : "inactiva"} ${String(k.cursos).padStart(2)} cursos`);
      if (rows.length === 0) console.log("   (ninguna)");
    });

    seccion("Instructores (entidad) y códigos de invitación y planes");
    await intentar(db, "instructores", async () => {
      const { rows } = await db.query(`
        select i.id::text as id, i.nombre, i.id_perfil_profesor is not null as vinculado_a_cuenta,
               (select count(*)::int from public.cursos c where c.id_instructor = i.id) as cursos
          from public.instructores i order by i.nombre`);
      reporte.instructores = rows;
      for (const i of rows) console.log(`   instructor  ${String(i.nombre).padEnd(34)} ${String(i.cursos).padStart(2)} cursos${i.vinculado_a_cuenta ? " · vinculado a una cuenta" : ""}`);
    });
    await intentar(db, "codigos", async () => {
      const { rows } = await db.query(`
        select codigo, activo, veces_usado, limite_usos, fecha_vencimiento > now() as vigente
          from public.codigos_invitacion order by creado_en`);
      reporte.codigos = rows;
      for (const c of rows) console.log(`   código      ${String(c.codigo).padEnd(20)} ${c.activo ? "activo  " : "apagado "} ${c.vigente ? "vigente " : "vencido "} usos ${c.veces_usado}/${c.limite_usos}`);
    });
    await intentar(db, "planes", async () => {
      const { rows } = await db.query("select id::text as id, nombre, activo from public.planes order by nombre");
      reporte.planes = rows;
      for (const p of rows) console.log(`   plan        ${String(p.nombre).padEnd(34)} ${p.activo ? "activo" : "inactivo"}`);
    });

    seccion("Lo que usa el curso que se queda (Taller de Presupuestos de Obra)");
    await intentar(db, "curso_que_se_queda", async () => {
      const { rows } = await db.query(`
        select c.id::text as id, c.titulo,
               (select coalesce(json_agg(k.nombre), '[]') from public.curso_categorias cc join public.categorias k on k.id = cc.id_categoria where cc.id_curso = c.id) as categorias,
               (select i.nombre from public.instructores i where i.id = c.id_instructor) as instructor,
               (select coalesce(json_agg(p.correo), '[]') from public.curso_instructores ci join public.perfiles p on p.id = ci.id_instructor where ci.id_curso = c.id) as profesores
          from public.cursos c where c.slug like 'taller-de-presupuestos-de-obra%'`);
      reporte.curso_que_se_queda = rows;
      for (const c of rows) console.log(`   ${c.titulo}
      categorías: ${JSON.stringify(c.categorias)}
      instructor: ${c.instructor ?? "—"}
      profesores: ${JSON.stringify(c.profesores)}`);
    });

    // 6. Bitácora de las cuentas de prueba -----------------------------------
    seccion("Bitácora administrativa de las cuentas de prueba (qué se hizo con ellas)");
    await intentar(db, "bitacora", async () => {
      const { rows } = await db.query(
        `select b.accion, b.entidad_afectada as entidad, count(*)::int as veces,
                min(b.creado_en) as primera, max(b.creado_en) as ultima
           from public.bitacora_administrativa b where b.id_admin = any($1::uuid[])
          group by 1, 2 order by ultima desc`,
        [idsPrueba],
      );
      reporte.bitacora_resumen = rows;
      for (const b of rows) console.log(`   ${String(b.accion).padEnd(34)} ${String(b.entidad).padEnd(22)} ${String(b.veces).padStart(3)}x  ${new Date(b.primera as string).toISOString().slice(0, 10)} → ${new Date(b.ultima as string).toISOString().slice(0, 10)}`);
      const recientes = await db.query(
        `select b.creado_en, b.accion, b.entidad_afectada as entidad, left(b.detalles, 120) as detalles
           from public.bitacora_administrativa b where b.id_admin = any($1::uuid[])
          order by b.creado_en desc limit 30`,
        [idsPrueba],
      );
      reporte.bitacora_recientes = recientes.rows;
    });

    // 7. Accesos --------------------------------------------------------------
    seccion("Accesos de las cuentas de prueba");
    await intentar(db, "sesiones", async () => {
      const { rows } = await db.query(
        `select u.email, s.ip::text as ip, s.user_agent, s.created_at
           from auth.sessions s join auth.users u on u.id = s.user_id
          where s.user_id = any($1::uuid[]) order by s.created_at`,
        [idsPrueba],
      );
      reporte.sesiones = rows;
      console.log(`   Sesiones guardadas: ${rows.length}`);
      for (const r of rows) console.log(`   ${r.email}  ${String(r.ip).padEnd(40)} ${new Date(r.created_at as string).toISOString().slice(0, 16)}`);
    });

    await intentar(db, "registro_auditoria", async () => {
      const { rows } = await db.query(
        `select payload->>'actor_username' as email, payload->>'action' as accion,
                ip_address::text as ip, count(*)::int as veces,
                min(created_at) as primera, max(created_at) as ultima
           from auth.audit_log_entries
          where payload->>'actor_id' = any($1::text[])
          group by 1, 2, 3 order by 1, ultima desc`,
        [idsPrueba],
      );
      reporte.registro_auditoria = rows;
      console.log(`\n   Registro de auditoría de Auth (agrupado por acción e IP): ${rows.length} grupos`);
      for (const r of rows) {
        console.log(`   ${String(r.email).padEnd(30)} ${String(r.accion).padEnd(18)} ${String(r.ip).padEnd(40)} ${String(r.veces).padStart(3)}x  ${new Date(r.primera as string).toISOString().slice(0, 10)} → ${new Date(r.ultima as string).toISOString().slice(0, 10)}`);
      }
      if (rows.length === 0) console.log("   (vacío: o no hubo accesos, o el proyecto no guarda auditoría en la base — revisar Auth → Logs en el panel)");
    });

    await db.query("rollback");
  } finally {
    await db.end();
  }

  mkdirSync("respaldos", { recursive: true });
  const archivo = `respaldos/listado-datos-prueba-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(archivo, JSON.stringify(reporte, null, 2));
  console.log(`\n💾 Detalle completo: ${archivo}\n`);
}

main().catch((error) => {
  console.error("\n❌ Falló:", error);
  process.exitCode = 1;
});
