/**
 * Falla si alguna policy llama `private.es_administrador()` o
 * `public.comunidad_tiene_acceso()` sin envolver en una subconsulta escalar —
 * es decir, si vuelve a evaluarse una vez por fila en vez de una vez por
 * consulta.
 *
 * `comunidad_tiene_acceso()` se sumó con 113 (AUDIT-2026-09-15.md, P2-10):
 * toda la RLS de Comunidad la llamaba desnuda y, con 20.000 publicaciones,
 * el feed superaba el statement_timeout. Cualquier otra función SIN
 * argumentos que se use en policies tiene el mismo riesgo: agregarla a
 * FUNCIONES_IZABLES.
 *
 * Uso: npm run db:check-rls-initplan
 *
 * Por qué existe (AUDIT-2026-09-15.md, P2-2)
 * ------------------------------------------
 * Misma historia que check-fk-indexes.ts, un escalón más arriba.
 * 077_es_administrador_initplan.sql corrigió ~75 policies de una sentada el
 * 08-sep. Una semana después, `pg_policies` tenía 27 policies con 36
 * llamadas desnudas otra vez: todo lo que llegó después de 077 (Comunidad,
 * adjuntos, exámenes IA, transcripciones, pagos, calificaciones) volvió a
 * escribirla igual, porque nada lo comprobaba. 105 las volvió a izar; este
 * script es lo único que impide una tercera pasada.
 *
 * El linter de Supabase NO sirve para esto, y conviene decirlo aquí: su
 * regla `auth_rls_initplan` reconoce `auth.<fn>()` y `current_setting()`
 * literales, así que una policy que llama `private.es_administrador()` le
 * sale en verde. Es el caso de manual de que un linter en verde describe lo
 * que el linter mira, no lo que el sistema hace.
 *
 * Contra el catálogo, no contra los archivos
 * -------------------------------------------
 * Se consulta `pg_policies` y no `supabase/sql/*.sql` a propósito: los
 * archivos se aplican en orden y se pisan entre sí (077 redefine policies
 * que 001-076 escribieron, 105 redefine las de 083-102). Un grep sobre los
 * archivos marcaría como rotas decenas de policies que la base ya tiene
 * bien, y no vería una policy creada a mano en el SQL Editor. El estado que
 * importa es el que la base tiene.
 *
 * Por eso corre en CI DESPUÉS de `npm run db:rls`, no antes.
 *
 * Qué NO mira
 * -----------
 * · Las llamadas dentro de funciones plpgsql (triggers de transiciones): ahí
 *   es una llamada procedural por invocación, no un predicado por fila.
 *   Envolverla no cambiaría nada.
 * · Las VISTAS que llaman `es_administrador()` en su WHERE (061, 074, 076,
 *   092, 093, 102). Tienen el mismo problema y el mismo remedio, pero 105 no
 *   las corrigió — y este gate no las mira para no afirmar en verde algo que
 *   nadie revisó. Cuando se arreglen, se amplía la consulta de abajo.
 * · `private.tiene_acceso_vigente_curso(c.id)` y demás llamadas
 *   CORRELACIONADAS (reciben una columna de la fila): envolverlas no las iza
 *   a InitPlan, solo disfraza el mismo trabajo. Ver el encabezado de 077.
 */

import { Client } from "pg";

// .env.local no existe en CI, donde las variables llegan del entorno.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("\n❌ Falta DATABASE_URL (.env.local en local, secrets en CI).\n");
  process.exit(1);
}

/**
 * Alternancia deliberada: la forma YA izada —tal como la imprime el
 * catálogo, `( SELECT private.es_administrador() AS es_administrador)`— se
 * empareja PRIMERO y se descarta. Lo que quede emparejando la segunda rama
 * es una llamada desnuda de verdad.
 *
 * Sin ese orden, la segunda rama emparejaría también el interior de la
 * primera y el gate fallaría sobre las policies correctas.
 */
const FUNCIONES_IZABLES = [
  // El catálogo la imprime con el schema.
  { nombre: "private.es_administrador()", patron: String.raw`private\.es_administrador\(\)` },
  // `public` está en el search_path: el catálogo la imprime sin schema.
  { nombre: "public.comunidad_tiene_acceso()", patron: String.raw`(?:public\.)?comunidad_tiene_acceso\(\)` },
];

const LLAMADA = new RegExp(
  FUNCIONES_IZABLES.map(({ patron }) => String.raw`\(\s*SELECT\s+${patron}[^)]*\)|${patron}`).join("|"),
  "gi",
);

function desnudas(expresion: string | null): number {
  if (!expresion) return 0;
  let total = 0;
  for (const encontrada of expresion.matchAll(LLAMADA)) {
    if (!encontrada[0].startsWith("(")) total++;
  }
  return total;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query<{
      schemaname: string;
      tablename: string;
      policyname: string;
      cmd: string;
      qual: string | null;
      with_check: string | null;
    }>(`
      select schemaname, tablename, policyname, cmd, qual, with_check
      from pg_policies
      where coalesce(qual, '') || coalesce(with_check, '') like '%es_administrador%'
         or coalesce(qual, '') || coalesce(with_check, '') like '%comunidad_tiene_acceso%'
      order by schemaname, tablename, policyname
    `);

    const rotas = rows
      .map((fila) => ({
        ...fila,
        cuantas: desnudas(fila.qual) + desnudas(fila.with_check),
      }))
      .filter((fila) => fila.cuantas > 0);

    if (rotas.length > 0) {
      const llamadas = rotas.reduce((acc, fila) => acc + fila.cuantas, 0);
      console.error(
        `\n❌ ${rotas.length} policy(s) con ${llamadas} llamada(s) sin izar a ${FUNCIONES_IZABLES.map((f) => f.nombre).join(" / ")}:\n`,
      );
      for (const fila of rotas) {
        console.error(
          `   ${fila.schemaname}.${fila.tablename}  ${fila.policyname} [${fila.cmd}] — ${fila.cuantas}`,
        );
      }
      console.error(
        "\n   Se evalúa una vez POR FILA en vez de una vez por consulta.\n" +
          "   Remedio: envolver en subconsulta escalar, igual que 077 y 105:\n" +
          "     private.es_administrador()  →  (select private.es_administrador())\n" +
          "     public.comunidad_tiene_acceso()  →  (select public.comunidad_tiene_acceso())\n" +
          "\n   Ojo: NO envolver private.tiene_acceso_vigente_curso(<columna>) ni\n" +
          "   ninguna llamada que reciba una columna de la fila — son correlacionadas\n" +
          "   y envolverlas no las iza, solo disfraza el mismo trabajo (ver 077).\n",
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `\n✅ Las ${rows.length} policies que llaman ${FUNCIONES_IZABLES.map((f) => f.nombre).join(" o ")} las evalúan una vez por consulta.\n`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
