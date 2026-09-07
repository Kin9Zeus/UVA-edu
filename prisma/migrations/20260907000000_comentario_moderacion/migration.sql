-- ============================================================
-- Tabla comentario_moderacion: evidencia de un comentario que un
-- ADMINISTRADOR eliminó por moderación (no el propio autor).
--
-- Acompaña el cambio de eliminarComentario (src/actions/comentarios/
-- eliminar.ts) que ahora vacía `comentarios.contenido` al borrar: RLS
-- protege filas, no columnas, así que dejar el texto ahí permitía leer el
-- contenido "borrado" con cualquier acceso a la lección. Cuando quien
-- borra es un admin (no el autor), el texto se copia acá antes de
-- vaciarse, para no perder el rastro de un comentario abusivo.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- las migraciones anteriores (P4002 por el FK de perfiles hacia
-- auth.users: la shadow database de `prisma migrate dev` no tiene ese
-- esquema).
--
-- RLS vive en supabase/sql/065_comentario_moderacion.sql (npm run db:rls),
-- no acá.
-- ============================================================

CREATE TABLE "comentario_moderacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_comentario" UUID NOT NULL,
    "contenido_original" TEXT NOT NULL,
    "id_eliminado_por" UUID NOT NULL,
    "creado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "comentario_moderacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comentario_moderacion_id_comentario_idx"
    ON "comentario_moderacion"("id_comentario");

ALTER TABLE "comentario_moderacion" ADD CONSTRAINT "comentario_moderacion_id_comentario_fkey"
    FOREIGN KEY ("id_comentario") REFERENCES "comentarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentario_moderacion" ADD CONSTRAINT "comentario_moderacion_id_eliminado_por_fkey"
    FOREIGN KEY ("id_eliminado_por") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
