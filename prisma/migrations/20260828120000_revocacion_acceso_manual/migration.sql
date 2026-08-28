-- ============================================================
-- Revocación de acceso manual sin borrar el registro (f4accesos.md)
--
-- "Revocar no borra el registro: lo marca como inactivo con fecha y
-- motivo." Antes de esta migración, quitar una cortesía (Inscripciones)
-- era un DELETE real -- sin rastro -- y no existía forma de revocar una
-- membresía manual (Suscripciones) en absoluto.
--
-- Escrita a mano en vez de con `prisma migrate dev`: ese comando falla en
-- este proyecto con P4002 al introspectar la base de sombra, porque
-- `perfiles.id` referencia `auth.users` (schema que Prisma no gestiona) --
-- mismo motivo por el que las mutaciones de la app pasan por
-- @supabase/supabase-js y no por Prisma Client (ver CLAUDE.md §2). Se
-- aplica con `prisma migrate deploy`, que no necesita la base de sombra.
-- ============================================================

-- Suscripciones: motivo de la cancelación manual y quién la ejecutó.
-- "Inactivo" ya lo dice estado = 'CANCELADA' (enum existente); "fecha" ya
-- lo da actualizado_en (se refresca solo en cada UPDATE), así que no hace
-- falta una columna de fecha aparte.
ALTER TABLE "suscripciones" ADD COLUMN "motivo_cancelacion" TEXT;
ALTER TABLE "suscripciones" ADD COLUMN "cancelado_por" UUID;

ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_cancelado_por_fkey"
  FOREIGN KEY ("cancelado_por") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Inscripciones: no tenía ningún campo de estado -- una cortesía revocada
-- desaparecía por completo (DELETE). "activo" es lo que ahora deciden las
-- policies de RLS y los chequeos de acceso en TypeScript (no `estado`,
-- para no confundirla con el enum de Suscripciones que sí tiene múltiples
-- estados).
ALTER TABLE "inscripciones" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "inscripciones" ADD COLUMN "revocado_en" TIMESTAMPTZ;
ALTER TABLE "inscripciones" ADD COLUMN "motivo_revocacion" TEXT;
ALTER TABLE "inscripciones" ADD COLUMN "revocado_por" UUID;

ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_revocado_por_fkey"
  FOREIGN KEY ("revocado_por") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
