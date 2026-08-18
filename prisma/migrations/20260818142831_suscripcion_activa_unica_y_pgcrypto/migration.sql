-- Asegura que gen_random_uuid() (usado como default de todas las PKs UUID del
-- esquema, ver dbgenerated("gen_random_uuid()") en schema.prisma) esté siempre
-- disponible, incluso si este esquema se aplica alguna vez sobre un Postgres
-- que no sea un proyecto Supabase (donde pgcrypto viene habilitado por
-- defecto). No se agregó a la migración `20260812234816_init` para no alterar
-- el checksum de una migración ya aplicada en la base de datos real
-- (Prisma Migrate detecta ese cambio y exige un `migrate reset`, lo cual
-- borraría políticas RLS y triggers que no viven en el historial de Prisma).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Regla de negocio: un usuario solo puede tener UNA suscripción con estado
-- ACTIVA o PAST_DUE al mismo tiempo. Sí puede acumular múltiples
-- suscripciones históricas en estado VENCIDA o CANCELADA sin límite.
-- Prisma no soporta índices únicos parciales (con cláusula WHERE) de forma
-- nativa en schema.prisma, por lo que esta restricción se define aquí como
-- SQL crudo en vez de con @@unique.
CREATE UNIQUE INDEX "suscripcion_activa_unica_por_usuario"
  ON "suscripciones" ("id_usuario")
  WHERE "estado" IN ('ACTIVA', 'PAST_DUE');
