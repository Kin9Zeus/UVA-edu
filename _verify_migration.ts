import { PrismaClient } from "./src/generated/prisma/client.ts";

async function main() {
  const prisma = new PrismaClient();

  const indexes = await prisma.$queryRawUnsafe(
    `select indexname, indexdef from pg_indexes where tablename in ('suscripciones', 'certificados') order by tablename, indexname;`
  );
  console.log("INDEXES:", JSON.stringify(indexes, null, 2));

  const ext = await prisma.$queryRawUnsafe(
    `select extname from pg_extension where extname = 'pgcrypto';`
  );
  console.log("PGCRYPTO:", JSON.stringify(ext, null, 2));

  const cuponesCol = await prisma.$queryRawUnsafe(
    `select column_name, data_type, udt_name, is_nullable from information_schema.columns where table_name = 'cupones' and column_name = 'tipo_descuento';`
  );
  console.log("CUPONES.tipo_descuento:", JSON.stringify(cuponesCol, null, 2));

  const inscripcionesCol = await prisma.$queryRawUnsafe(
    `select column_name, is_nullable from information_schema.columns where table_name = 'inscripciones' and column_name = 'id_curso';`
  );
  console.log("INSCRIPCIONES.id_curso:", JSON.stringify(inscripcionesCol, null, 2));

  await prisma.$disconnect();
}

main();
