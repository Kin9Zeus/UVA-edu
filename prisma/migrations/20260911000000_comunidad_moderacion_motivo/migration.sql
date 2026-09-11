-- AlterTable
ALTER TABLE "comunidad_posts" ADD COLUMN "eliminado_por_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "comunidad_respuestas" ADD COLUMN "eliminado_por_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "comunidad_moderacion" ADD COLUMN "motivo" TEXT;
