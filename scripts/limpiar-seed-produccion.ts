/**
 * Borra de producción las cuentas, cursos, categorías, códigos e instructores
 * que dejó el seed (2026-10-05, tarea "eliminar cuenta admin del seed y datos de
 * prueba en producción"). Registro versionado: no se hace a mano en el panel.
 *
 * Qué borra (todo explícito, nada por patrón de nombre):
 *   - Las cuentas de CUENTAS_PRUEBA (7 + 2 anonimizadas), con todo lo que cuelga de ellas.
 *   - Los 5 cursos de CURSOS_PRUEBA (el seed y los de prueba del equipo).
 *   - Los 6 códigos de CODIGOS_SEED y los 3 instructores del seed.
 *   - Las categorías que NO usa el curso que se queda, y que crearon las
 *     cuentas de prueba (o no tienen autor). Una categoría creada después por
 *     una persona real no se toca, así que volver a correr el script es seguro.
 *
 * Qué conserva: el curso CURSO_QUE_SE_QUEDA (y lo suyo: módulos, clases,
 * progreso de estudiantes reales). Como lo creó `admin@uva.test`, se
 * reasigna antes a otra cuenta (`--reasignar-a=`), que debe ser ADMINISTRADOR.
 *
 * Cómo borra: sigue las llaves foráneas del catálogo de Postgres (RESTRICT y
 * NO ACTION) hacia abajo, hijas antes que padres, todo en UNA transacción. Las
 * CASCADE y SET NULL las resuelve la propia base. La bitácora es append-only
 * (074): se purga por la puerta declarada, `purgar_bitacora_de_admin()`.
 *
 * Seguridad:
 *   - Por defecto SOLO LISTA lo que borraría (y deshace la reasignación).
 *   - `--probar` ejecuta todos los borrados y hace ROLLBACK: demuestra que la
 *     base los acepta sin tocar nada.
 *   - Si el plan alcanza filas de cuentas que NO son de prueba (p. ej. un
 *     certificado de un estudiante real en un curso de prueba) o un curso que
 *     no está en la lista, se detiene. `--aceptar-ajenos` permite lo primero,
 *     tras revisarlo.
 *   - Antes de borrar guarda todo en `respaldos/limpieza-seed-<fecha>.json`
 *     (ignorado por git: lleva correos e ids).
 *
 * Uso:
 *   ENV_FILE=.env.produccion.local npm run db:limpiar-seed -- --reasignar-a=correo@dominio.com
 *   ENV_FILE=.env.produccion.local npm run db:limpiar-seed -- --reasignar-a=correo@dominio.com --probar
 *   ENV_FILE=.env.produccion.local npm run db:limpiar-seed -- --reasignar-a=correo@dominio.com --confirmar=<ref>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const CUENTAS_PRUEBA = [
  "admin@uva.test",
  "estudiante-activo@uva.test",
  "estudiante-pastdue@uva.test",
  "estudiante-por-codigo@uva.test",
  "estudiante-sin-plan@uva.test",
  "estudiante-suspendido@uva.test",
  "pruebandres@test.com",
  // 2026-10-05, segunda tanda: cuentas anonimizadas de una prueba de supresión (075).
  "anon+76f3d855f30f4f33b1f5e04940280dd5@uva.invalid",
  "anon+9a632d5c251440188723fb31c9a04168@uva.invalid",
];

const CURSOS_PRUEBA = [
  "render-fotorrealista-con-v-ray",
  "revit-desde-cero-para-arquitectos",
  "lumion-y-twinmotion-visualizacion-en-tiempo-real",
  "presupuestos-de-disenos",
  "prueba-examen",
];

const CURSO_QUE_SE_QUEDA = "taller-de-presupuestos-de-obra-analisis-de-precios-unitarios";

const CODIGOS_SEED = [
  "UVA-BIENVENIDA-2026",
  "UVA-UNICO-2026",
  "UVA-TRIMESTRE-2026",
  "UVA-AGOTADO-2026",
  "UVA-VENCIDO-2025",
  "UVA-APAGADO-2026",
];

/** Ana Ruiz, Daniel Castaño y Mauricio Gallego (ids fijos del seed). */
const INSTRUCTORES_SEED = [
  "2a000000-0000-4000-8000-000000000001",
  "2a000000-0000-4000-8000-000000000002",
  "2a000000-0000-4000-8000-000000000003",
];

const arg = (nombre: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
const CONFIRMACION = arg("confirmar");
const REASIGNAR_A = arg("reasignar-a")?.trim().toLowerCase();
const PROBAR = process.argv.includes("--probar");
const ACEPTAR_AJENOS = process.argv.includes("--aceptar-ajenos");

function abortar(mensaje: string): never {
  console.error(`\n❌ ${mensaje}\n`);
  process.exit(1);
}

/** Para identificadores que vienen del catálogo de Postgres, nunca de entrada externa. */
const ident = (nombre: string): string => nombre.split(".").map((p) => `"${p.replace(/"/g, '""')}"`).join(".");

type Referencia = { tabla: string; columna: string; accion: string };
type Paso = { tabla: string; col: string; valores: string[]; filas: string[]; purga: boolean };

async function main(): Promise<void> {
  const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL) abortar("Faltan DATABASE_URL o NEXT_PUBLIC_SUPABASE_URL.");
  if (!REASIGNAR_A) abortar("Falta --reasignar-a=<correo de un administrador>: el curso que se queda lo creó una cuenta de prueba.");
  const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  console.log(`\n🎯 Proyecto: ${ref}${PROBAR ? "  (modo --probar: se revierte todo)" : ""}`);
  if (CONFIRMACION !== undefined && CONFIRMACION !== ref) abortar(`--confirmar=${CONFIRMACION} no coincide con el proyecto ${ref}.`);

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;

  try {
    await db.query("begin");

    // --- Resolver qué es qué ---------------------------------------------------
    const cuentas = await q(`select id::text as id, email from auth.users where lower(email) = any($1::text[])`, [CUENTAS_PRUEBA]);
    const idsCuentas = cuentas.map((c) => String(c.id));
    const faltan = CUENTAS_PRUEBA.filter((e) => !cuentas.some((c) => String(c.email).toLowerCase() === e));
    const correoDe = new Map(cuentas.map((c) => [String(c.id), String(c.email)]));

    const destino = (
      await q(
        `select p.id::text as id, u.email from public.perfiles p join auth.users u on u.id = p.id
          where lower(u.email) = $1 and p.rol = 'ADMINISTRADOR' and p.estado = 'ACTIVO' and p.anonimizado_en is null`,
        [REASIGNAR_A],
      )
    )[0];
    if (!destino) abortar(`${REASIGNAR_A} no es un ADMINISTRADOR activo: promuévelo primero con npm run db:promover-admin.`);
    if (idsCuentas.includes(String(destino.id))) abortar("--reasignar-a no puede ser una cuenta de prueba.");

    const cursoQueSeQueda = (await q("select id::text as id, titulo, id_admin_creador::text as creador from public.cursos where slug = $1", [CURSO_QUE_SE_QUEDA]))[0];
    if (!cursoQueSeQueda) abortar(`No existe el curso que debe quedarse (${CURSO_QUE_SE_QUEDA}). No se borra nada.`);

    const cursosBorrar = (await q("select id::text as id, titulo, slug, imagen_portada from public.cursos where slug = any($1::text[])", [CURSOS_PRUEBA]));
    const codigosBorrar = (await q("select id::text as id, codigo from public.codigos_invitacion where codigo = any($1::text[])", [CODIGOS_SEED]));
    const instructoresBorrar = (await q("select id::text as id, nombre from public.instructores where id = any($1::uuid[])", [INSTRUCTORES_SEED]));
    const categoriasBorrar = await q(
      `select k.id::text as id, k.nombre from public.categorias k
        where not exists (select 1 from public.curso_categorias cc where cc.id_categoria = k.id and cc.id_curso = $1::uuid)
          and (k.id_admin_creador is null or k.id_admin_creador = any($2::uuid[]))`,
      [cursoQueSeQueda.id, idsCuentas],
    );
    const categoriasQueSeQuedan = await q(
      `select k.nombre from public.categorias k join public.curso_categorias cc on cc.id_categoria = k.id where cc.id_curso = $1::uuid`,
      [cursoQueSeQueda.id],
    );

    console.log(`\nSe queda: ${cursoQueSeQueda.titulo}`);
    console.log(`   categorías que se quedan: ${categoriasQueSeQuedan.map((k) => k.nombre).join(", ") || "(ninguna)"}`);
    console.log(`   creador pasa a: ${destino.email}`);
    if (faltan.length) console.log(`\nCuentas de la lista que ya no existen (ok): ${faltan.join(", ")}`);
    console.log(`\nSe borra:`);
    console.log(`   cuentas:      ${cuentas.map((c) => c.email).join(", ") || "(ninguna)"}`);
    console.log(`   cursos:       ${cursosBorrar.map((c) => c.titulo).join(" | ") || "(ninguno)"}`);
    console.log(`   categorías:   ${categoriasBorrar.map((k) => k.nombre).join(", ") || "(ninguna)"}`);
    console.log(`   códigos:      ${codigosBorrar.map((c) => c.codigo).join(", ") || "(ninguno)"}`);
    console.log(`   instructores: ${instructoresBorrar.map((i) => i.nombre).join(", ") || "(ninguno)"}`);

    // --- Reasignar el curso que se queda ----------------------------------------
    if (idsCuentas.includes(String(cursoQueSeQueda.creador))) {
      await db.query("update public.cursos set id_admin_creador = $2::uuid where id = $1::uuid", [cursoQueSeQueda.id, destino.id]);
      console.log(`\n↪ ${cursoQueSeQueda.titulo}: creador reasignado a ${destino.email}`);
    }

    // --- Planear el borrado siguiendo las llaves foráneas ----------------------
    const refsCache = new Map<string, Referencia[]>();
    const referencias = async (tabla: string): Promise<Referencia[]> => {
      const hit = refsCache.get(tabla);
      if (hit) return hit;
      const filas = (await q(
        `select format('%I.%I', n.nspname, r.relname) as tabla, a.attname as columna,
                case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
                                   when 'c' then 'CASCADE' when 'n' then 'SET NULL' else c.confdeltype::text end as accion
           from pg_constraint c
           join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
          where c.contype = 'f' and c.confrelid = $1::regclass and array_length(c.conkey, 1) = 1
          order by 1, 2`,
        [tabla],
      )) as Referencia[];
      refsCache.set(tabla, filas);
      return filas;
    };
    const conId = new Set(
      (await q(`select format('%I.%I', table_schema, table_name) as t from information_schema.columns
                 where column_name = 'id' and data_type = 'uuid' and table_schema in ('public', 'auth')`)).map((r) => String(r.t)),
    );

    const pasos: Paso[] = [];
    const planeadas = new Map<string, Set<string>>();
    const sinIdVistos = new Set<string>();
    async function planear(tabla: string, col: string, valores: string[]): Promise<void> {
      if (valores.length === 0) return;
      if (tabla === "public.bitacora_administrativa") {
        // Solo se alcanza por id_admin. Se purga por la puerta declarada (074), no con un DELETE suelto.
        const [{ n }] = await q(`select count(*)::int as n from ${ident(tabla)} where ${ident(col)} = any($1::uuid[])`, [valores]);
        if (n > 0) pasos.push({ tabla, col, valores, filas: [], purga: true });
        return;
      }
      if (conId.has(tabla)) {
        const todas = (await q(`select id::text as id from ${ident(tabla)} where ${ident(col)} = any($1::uuid[])`, [valores])).map((r) => String(r.id));
        const ya = planeadas.get(tabla) ?? new Set<string>();
        const filas = todas.filter((id) => !ya.has(id));
        if (filas.length === 0) return;
        planeadas.set(tabla, new Set([...ya, ...filas]));
        // También las CASCADE: la base las borraría sola, pero sus propias hijas
        // RESTRICT (p. ej. recursos de una clase) frenarían el borrado.
        for (const ref of await referencias(tabla)) {
          if (ref.accion !== "SET NULL") await planear(ref.tabla, ref.columna, filas);
        }
        pasos.push({ tabla, col: "id", valores: filas, filas, purga: false });
        return;
      }
      const clave = `${tabla}|${col}|${[...valores].sort().join(",")}`;
      if (sinIdVistos.has(clave)) return;
      sinIdVistos.add(clave);
      const [{ n }] = await q(`select count(*)::int as n from ${ident(tabla)} where ${ident(col)} = any($1::uuid[])`, [valores]);
      if (n === 0) return;
      pasos.push({ tabla, col, valores, filas: [], purga: false });
    }

    await planear("public.cursos", "id", cursosBorrar.map((c) => String(c.id)));
    await planear("public.codigos_invitacion", "id", codigosBorrar.map((c) => String(c.id)));
    await planear("public.instructores", "id", instructoresBorrar.map((i) => String(i.id)));
    await planear("public.categorias", "id", categoriasBorrar.map((k) => String(k.id)));
    await planear("public.perfiles", "id", idsCuentas);

    // --- Comprobaciones antes de tocar nada ------------------------------------
    const cursosEnPlan = new Set(pasos.filter((p) => p.tabla === "public.cursos").flatMap((p) => p.filas));
    const cursosPermitidos = new Set(cursosBorrar.map((c) => String(c.id)));
    const cursosDeMas = [...cursosEnPlan].filter((id) => !cursosPermitidos.has(id));
    if (cursosDeMas.length) abortar(`El plan alcanzaría cursos que no están en la lista: ${cursosDeMas.join(", ")}. No se borra nada.`);
    if (cursosEnPlan.has(String(cursoQueSeQueda.id))) abortar("El plan alcanzaría el curso que debe quedarse. No se borra nada.");

    const columnasPerfil = new Map<string, string[]>();
    for (const ref of await referencias("public.perfiles")) {
      columnasPerfil.set(ref.tabla, [...(columnasPerfil.get(ref.tabla) ?? []), ref.columna]);
    }
    const ajenos: { tabla: string; columna: string; correo: string; filas: number }[] = [];
    for (const paso of pasos) {
      if (paso.tabla === "public.perfiles") continue;
      for (const pcol of columnasPerfil.get(paso.tabla) ?? []) {
        const filas = await q(
          `select t.${ident(pcol)}::text as id, count(*)::int as filas from ${ident(paso.tabla)} t
            where t.${ident(paso.col)} = any($1::uuid[]) and t.${ident(pcol)} is not null and t.${ident(pcol)} <> all($2::uuid[])
            group by 1`,
          [paso.valores, idsCuentas],
        );
        for (const f of filas) {
          const [u] = await q("select email from auth.users where id = $1::uuid", [f.id]);
          ajenos.push({ tabla: paso.tabla, columna: pcol, correo: String(u?.email ?? f.id), filas: Number(f.filas) });
        }
      }
    }

    // --- Mostrar el plan ---------------------------------------------------------
    console.log(`\nPlan de borrado (hijas antes que padres):`);
    const porTabla = new Map<string, number>();
    for (const p of pasos) {
      const n = p.filas.length || (await q(`select count(*)::int as n from ${ident(p.tabla)} where ${ident(p.col)} = any($1::uuid[])`, [p.valores]))[0].n;
      porTabla.set(p.tabla, (porTabla.get(p.tabla) ?? 0) + Number(n));
    }
    for (const [tabla, n] of porTabla) console.log(`   ${tabla.replace("public.", "").padEnd(34)} ${String(n).padStart(5)} filas`);
    console.log(`   ${"auth.users".padEnd(34)} ${String(idsCuentas.length).padStart(5)} filas`);

    // Lo único de personas reales que puede caer DENTRO del curso que se queda: respuestas
    // (y "me gusta") colgadas de un comentario de una cuenta de prueba, que se borran en cascada.
    let colateral = 0;
    const comentarios = pasos.find((p) => p.tabla === "public.comentarios");
    if (comentarios) {
      const [{ n: respuestas }] = await q(
        `select count(*)::int as n from public.comentarios c
           join public.lecciones l on l.id = c.id_leccion join public.modulos m on m.id = l.id_modulo
          where m.id_curso = $2::uuid and c.id = any($1::uuid[]) and c.id_usuario <> all($3::uuid[])`,
        [comentarios.filas, cursoQueSeQueda.id, idsCuentas],
      );
      const [{ n: likes }] = await q(
        `select count(*)::int as n from public.comentario_likes k join public.comentarios c on c.id = k.id_comentario
           join public.lecciones l on l.id = c.id_leccion join public.modulos m on m.id = l.id_modulo
          where m.id_curso = $2::uuid and c.id = any($1::uuid[]) and k.id_usuario <> all($3::uuid[])`,
        [comentarios.filas, cursoQueSeQueda.id, idsCuentas],
      );
      colateral = Number(respuestas) + Number(likes);
      console.log(`\nEn el curso que se queda se perderían: ${respuestas} comentarios de cuentas reales y ${likes} "me gusta" de cuentas reales (cuelgan de comentarios de prueba).`);
    }

    if (ajenos.length || colateral > 0) {
      console.log(`\n⚠️  El plan borra filas de cuentas que NO son de prueba:`);
      for (const a of ajenos) console.log(`   ${a.correo.padEnd(34)} ${a.tabla.replace("public.", "")}.${a.columna}: ${a.filas}`);
      if (!ACEPTAR_AJENOS && (CONFIRMACION !== undefined || PROBAR)) abortar("Revísalo; si es correcto, repite con --aceptar-ajenos. No se borró nada.");
    }

    const mux = await q(
      `select l.id_video_mux from public.lecciones l join public.modulos m on m.id = l.id_modulo
        where m.id_curso = any($1::uuid[]) and l.id_video_mux is not null`,
      [cursosBorrar.map((c) => c.id)],
    );
    const fotos = await q("select foto_url from public.perfiles where id = any($1::uuid[]) and foto_url is not null", [idsCuentas]);
    console.log(`\nA mano después (la base no los borra): ${mux.length} videos en Mux, ${cursosBorrar.length} portadas y ${fotos.length} fotos de perfil en Storage.`);

    if (!PROBAR && CONFIRMACION === undefined) {
      await db.query("rollback");
      console.log(`\nSolo listado. Ensayo: añade --probar. Para borrar: añade --confirmar=${ref}\n`);
      return;
    }

    // --- Respaldo y borrado --------------------------------------------------------
    if (!PROBAR) {
      const respaldo: Record<string, unknown> = { proyecto: ref, cuentas, mux: mux.map((m) => m.id_video_mux), portadas: cursosBorrar.map((c) => c.imagen_portada), fotos: fotos.map((f) => f.foto_url), filas: {} };
      for (const p of pasos) {
        const filas = await q(`select * from ${ident(p.tabla)} where ${ident(p.col)} = any($1::uuid[])`, [p.valores]);
        (respaldo.filas as Record<string, unknown[]>)[p.tabla] = [...((respaldo.filas as Record<string, unknown[]>)[p.tabla] ?? []), ...filas];
      }
      mkdirSync("respaldos", { recursive: true });
      const archivo = `respaldos/limpieza-seed-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      writeFileSync(archivo, JSON.stringify(respaldo, null, 2));
      console.log(`\n💾 Respaldo: ${archivo}`);
    }

    for (const p of pasos) {
      if (p.purga) {
        let borradas = 0;
        for (const id of p.valores) borradas += Number((await q("select public.purgar_bitacora_de_admin($1::uuid) as n", [id]))[0].n);
        console.log(`🗑️  ${p.tabla.replace("public.", "")}: ${borradas} (por purgar_bitacora_de_admin)`);
        continue;
      }
      const { rowCount } = await db.query(`delete from ${ident(p.tabla)} where ${ident(p.col)} = any($1::uuid[])`, [p.valores]);
      if (rowCount) console.log(`🗑️  ${p.tabla.replace("public.", "")}: ${rowCount}`);
    }
    const { rowCount: authBorradas } = await db.query("delete from auth.users where id = any($1::uuid[])", [idsCuentas]);
    console.log(`🗑️  auth.users: ${authBorradas}`);

    if (PROBAR) {
      await db.query("rollback");
      console.log("\n✅ Ensayo correcto: la base aceptó todos los borrados. Se revirtió todo, no cambió nada.\n");
    } else {
      await db.query("commit");
      console.log(`\n✅ Listo. Cuentas borradas: ${[...correoDe.values()].join(", ")}\n`);
    }
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
