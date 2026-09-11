-- ============================================================
-- Corrige `actualizado_en` en las tablas de Comunidad (20260909000000).
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- el resto (P4002 por el FK de perfiles hacia auth.users).
--
-- `prisma migrate diff` generó `actualizado_en TIMESTAMPTZ NOT NULL` sin
-- DEFAULT porque `@updatedAt` en schema.prisma es un comportamiento del
-- CLIENTE de Prisma, no algo que el motor traduzca a DDL — lo detectó el
-- primer INSERT real del arnés de RLS (comunidad_posts) con "null value in
-- column actualizado_en violates not-null constraint", porque la app
-- escribe con supabase-js (PostgREST), nunca con Prisma Client.
--
-- El resto del proyecto resuelve esto con `DEFAULT now()` en la columna +
-- un trigger `set_actualizado_en` que llama a la función ya existente
-- `private.actualiza_actualizado_en()` (ver
-- prisma/migrations/20260902000000_rol_profesor_y_comentarios, comentarios)
-- — se replica el mismo patrón acá para las tres tablas nuevas que tienen
-- la columna (comunidad_reacciones y comunidad_moderacion no la tienen: son
-- inmutables por diseño, no se actualizan nunca).
-- ============================================================

ALTER TABLE "comunidad_posts" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "comunidad_respuestas" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "configuracion_comunidad" ALTER COLUMN "actualizado_en" SET DEFAULT now();

DROP TRIGGER IF EXISTS set_actualizado_en ON public.comunidad_posts;
CREATE TRIGGER set_actualizado_en
    BEFORE UPDATE ON public.comunidad_posts
    FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();

DROP TRIGGER IF EXISTS set_actualizado_en ON public.comunidad_respuestas;
CREATE TRIGGER set_actualizado_en
    BEFORE UPDATE ON public.comunidad_respuestas
    FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();

DROP TRIGGER IF EXISTS set_actualizado_en ON public.configuracion_comunidad;
CREATE TRIGGER set_actualizado_en
    BEFORE UPDATE ON public.configuracion_comunidad
    FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();
