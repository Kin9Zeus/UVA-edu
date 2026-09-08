/**
 * Falla si alguna FK de una sola columna no es la columna líder de ningún
 * índice de su tabla (@@index, @@unique y PK componen pg_index igual que
 * @@index -- cualquiera de los tres cubre).
 *
 * Uso: npm run db:check-fk-indexes
 *
 * Por qué existe (AUDIT-2026-09-04.md, P2-3)
 * -------------------------------------------
 * Tercera vez que "FK nueva sin índice" aparece como hallazgo de auditoría
 * en vez de detectarse solo: P2-5 (24 de agosto), P2-3 (26 de agosto,
 * también P2-3 acá). Las dos veces anteriores se corrigió el índice
 * puntual y no quedó nada que impidiera una cuarta -- el patrón se repite
 * porque nada en CI lo comprueba, no porque falte cuidado puntual. Esta
 * misma consulta, corrida a mano mientras se escribía este archivo,
 * encontró un tercer caso real (comentario_moderacion.id_eliminado_por) en
 * una tabla que llegó el mismo día por otra rama -- la prueba de que hacía
 * falta el gate, no una migración más.
 *
 * Acotado a `public`
 * ------------------
 * Sin el filtro por esquema, la consulta también encuentra FKs sin índice
 * en `auth.*` y `storage.*` (mfa_challenges, oauth_authorizations,
 * s3_multipart_uploads_parts, etc.) -- tablas internas de Supabase que
 * este proyecto no crea ni puede migrar. Se descubrió corriendo la
 * consulta sin filtrar la primera vez: 16 de los 19 resultados eran de
 * ahí. `public` es el único esquema donde una migración de este repo
 * puede agregar un índice.
 *
 * Por qué solo FKs de una columna
 * --------------------------------
 * Verificado (AUDIT-2026-09-04.md, seguimiento P2-3): ninguna relación de
 * schema.prisma usa `fields: [a, b]` -- todas las FKs del proyecto son de
 * una sola columna hoy. Cubrir FKs compuestas exige comparar el prefijo
 * ordenado de conkey contra el de cada índice, no solo su primera entrada;
 * se deja para cuando exista una FK compuesta real, en vez de escribir esa
 * rama ahora sin nada que la ejerza.
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
  console.error("\n❌ Falta DATABASE_URL (en .env.local o en el entorno).\n");
  process.exit(1);
}

// con.conkey es un array de attnum (columnas de la FK, en orden); para una
// FK de una sola columna, conkey[1] es esa columna. idx.indkey[0] es la
// columna líder de cada índice -- si coincide, ese índice sirve para
// buscar por la FK sin seq scan, sin importar qué más tenga detrás.
const CONSULTA = `
  select con.conrelid::regclass as tabla, con.conname as fk, att.attname as columna
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
  where con.contype = 'f'
    -- Solo el esquema de la app: auth.* y storage.* son de Supabase, no de
    -- este proyecto -- no hay migración que pueda (ni deba) tocarlas.
    and con.connamespace = 'public'::regnamespace
    and array_length(con.conkey, 1) = 1
    and not exists (
      select 1 from pg_index idx
      where idx.indrelid = con.conrelid and idx.indkey[0] = con.conkey[1]
    )
  order by 1, 2;
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const { rows } = await client.query<{ tabla: string; fk: string; columna: string }>(CONSULTA);
  await client.end();

  if (rows.length === 0) {
    console.log("\n✅ Todas las FKs de una columna tienen índice de cobertura.\n");
    return;
  }

  console.error(`\n❌ ${rows.length} FK(s) sin índice de cobertura:\n`);
  for (const fila of rows) {
    console.error(`   ${fila.tabla}.${fila.columna} (${fila.fk})`);
  }
  console.error("\n   Agregar un índice sobre esa columna (o que la encabece) en una migración.\n");
  process.exit(1);
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
