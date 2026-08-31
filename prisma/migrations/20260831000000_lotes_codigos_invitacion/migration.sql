-- Lotes de códigos de invitación: opción "N códigos individuales" para la
-- generación masiva desde el panel admin (rev.md), como alternativa a
-- "código único con cupo de N usos" que ya existía. La decisión de negocio
-- de cuál modo usar en producción sigue pendiente — ambos conviven hasta que
-- se confirme (ver comentario en schema.prisma sobre LotesCodigosInvitacion).
--
-- Escrita a mano, no generada por `prisma migrate dev`: mismo motivo que
-- 20260824000000_agrega_codigos_invitacion — ese comando falla con P4002 al
-- introspeccionar la base real porque `perfiles_id_fkey` apunta a
-- `auth.users`, un schema fuera del alcance de Prisma. Aplicar con
-- `prisma migrate deploy` (no usa shadow database).

CREATE TABLE "lotes_codigos_invitacion" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "cantidad"            INTEGER NOT NULL,
    "duracion_dias"       INTEGER NOT NULL,
    "fecha_vencimiento"   TIMESTAMPTZ NOT NULL,
    "id_admin_creador"    UUID,
    "creado_en"           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "lotes_codigos_invitacion_pkey" PRIMARY KEY ("id")
);

-- Nullable + SET NULL, mismo criterio que codigos_invitacion.id_admin_creador:
-- borrar un administrador no debe quedar bloqueado por los lotes que generó.
ALTER TABLE "lotes_codigos_invitacion" ADD CONSTRAINT "lotes_codigos_invitacion_id_admin_creador_fkey"
    FOREIGN KEY ("id_admin_creador") REFERENCES "perfiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Cada código de un lote es una fila normal de codigos_invitacion
-- (limite_usos = 1), agrupada solo por esta columna. El canje
-- (canjear_codigo_invitacion) no cambia: sigue operando fila por fila.
ALTER TABLE "codigos_invitacion" ADD COLUMN "id_lote" UUID;

ALTER TABLE "codigos_invitacion" ADD CONSTRAINT "codigos_invitacion_id_lote_fkey"
    FOREIGN KEY ("id_lote") REFERENCES "lotes_codigos_invitacion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "codigos_invitacion_id_lote_idx" ON "codigos_invitacion"("id_lote");
