-- ============================================================
-- Rol PROFESOR + módulo de Comentarios (Revcurso).
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- las migraciones anteriores (P4002 por el FK de perfiles hacia
-- auth.users — ver 20260825020000_tokens_vista_previa).
--
-- RLS de las dos tablas nuevas vive en supabase/sql/051_rol_profesor.sql
-- y supabase/sql/052_comentarios.sql (npm run db:rls), no acá.
-- ============================================================

-- AlterEnum
ALTER TYPE "RolPerfil" ADD VALUE 'PROFESOR';

-- AlterTable: vínculo opcional Instructores -> Perfiles (cuenta PROFESOR).
ALTER TABLE "instructores" ADD COLUMN "id_perfil_profesor" UUID;

CREATE UNIQUE INDEX "instructores_id_perfil_profesor_key"
    ON "instructores"("id_perfil_profesor");

ALTER TABLE "instructores" ADD CONSTRAINT "instructores_id_perfil_profesor_fkey"
    FOREIGN KEY ("id_perfil_profesor") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: comentarios (un hilo por lección, un solo nivel de respuestas).
CREATE TABLE "comentarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_leccion" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_comentario_padre" UUID,
    "contenido" TEXT NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" timestamptz NOT NULL DEFAULT now(),
    "actualizado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comentarios_id_leccion_creado_en_idx"
    ON "comentarios"("id_leccion", "creado_en");

CREATE INDEX "comentarios_id_comentario_padre_idx"
    ON "comentarios"("id_comentario_padre");

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_id_leccion_fkey"
    FOREIGN KEY ("id_leccion") REFERENCES "lecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_id_usuario_fkey"
    FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_id_comentario_padre_fkey"
    FOREIGN KEY ("id_comentario_padre") REFERENCES "comentarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS set_actualizado_en ON public.comentarios;
CREATE TRIGGER set_actualizado_en
    BEFORE UPDATE ON public.comentarios
    FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();

-- CreateTable: comentario_likes (like/unlike, PK compuesta evita duplicados).
CREATE TABLE "comentario_likes" (
    "id_comentario" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "creado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "comentario_likes_pkey" PRIMARY KEY ("id_comentario","id_usuario")
);

ALTER TABLE "comentario_likes" ADD CONSTRAINT "comentario_likes_id_comentario_fkey"
    FOREIGN KEY ("id_comentario") REFERENCES "comentarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentario_likes" ADD CONSTRAINT "comentario_likes_id_usuario_fkey"
    FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
