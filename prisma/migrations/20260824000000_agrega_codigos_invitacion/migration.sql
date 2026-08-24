-- Códigos de invitación: canje por acceso completo a la plataforma
-- (equivalente a un plan de cortesía). Ver auditoría de RLS.
--
-- Escrita a mano, no generada por `prisma migrate dev`: ese comando falla
-- con P4002 al introspeccionar la base real, porque `perfiles_id_fkey`
-- (010_fk_perfiles_cascade_y_limpieza.sql) apunta a `auth.users`, un schema
-- fuera del alcance de Prisma (ver comentario en prisma/schema.prisma sobre
-- Perfiles.id). Mismo patrón que instructores_como_entidad: aplicar con
-- `prisma migrate deploy` (no usa shadow database).

CREATE TABLE "codigos_invitacion" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo"              TEXT NOT NULL,
    "id_plan"             UUID NOT NULL,
    "id_admin_creador"    UUID,
    "fecha_vencimiento"   TIMESTAMP(3) NOT NULL,
    "limite_usos"         INTEGER,
    "veces_usado"         INTEGER NOT NULL DEFAULT 0,
    "activo"              BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_invitacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "codigos_invitacion_codigo_key" ON "codigos_invitacion"("codigo");

ALTER TABLE "codigos_invitacion" ADD CONSTRAINT "codigos_invitacion_id_plan_fkey"
    FOREIGN KEY ("id_plan") REFERENCES "planes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nullable + SET NULL, mismo criterio que categorias/instructores.id_admin_creador:
-- borrar un administrador no debe quedar bloqueado por los códigos que emitió.
ALTER TABLE "codigos_invitacion" ADD CONSTRAINT "codigos_invitacion_id_admin_creador_fkey"
    FOREIGN KEY ("id_admin_creador") REFERENCES "perfiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "codigos_invitacion_id_plan_idx" ON "codigos_invitacion"("id_plan");

-- Suscripciones.id_codigo_invitacion: rastrea si una suscripción nació de
-- un canje (paralelo a id_cupon, que ya existía para descuentos).
ALTER TABLE "suscripciones" ADD COLUMN "id_codigo_invitacion" UUID;

ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_id_codigo_invitacion_fkey"
    FOREIGN KEY ("id_codigo_invitacion") REFERENCES "codigos_invitacion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "suscripciones_id_codigo_invitacion_idx" ON "suscripciones"("id_codigo_invitacion");
