-- ============================================================
-- Instructor y Profesor pasan a ser la MISMA entidad, y un curso admite
-- 1 o más.
--
-- Qué se corrige
-- --------------
-- La migración anterior (20260902000000_rol_profesor_y_comentarios) dejó dos
-- entidades para una sola persona: `instructores` (catálogo sin cuenta) y
-- `perfiles` con rol PROFESOR (cuenta real), unidas por
-- `instructores.id_perfil_profesor`. Eso obligaba a dar de alta a la misma
-- persona dos veces y a mantener sincronizados dos nombres. Además
-- `cursos.id_instructor` era una FK simple: un curso no podía tener dos.
--
-- A partir de aquí:
--   · `perfiles.especialidad` reemplaza a `instructores.especialidad`.
--   · `curso_instructores` (puente muchos-a-muchos hacia `perfiles`)
--     reemplaza a `cursos.id_instructor`.
--
-- Lo que esta migración NO hace, a propósito
-- ------------------------------------------
-- No borra `instructores` ni `cursos.id_instructor`, y no migra ningún dato
-- hacia `curso_instructores`. No puede: una fila de `perfiles` SOLO nace del
-- trigger sobre `auth.users` (supabase/sql/000_trigger_perfiles.sql), así que
-- no existe un INSERT válido que le invente una cuenta a los 3 instructores
-- reales con cursos publicados (Ana Ruiz, Daniel Castaño, Mauricio Gallego),
-- que hoy no tienen login. Tienen que registrarse en /registro y un admin
-- ascenderlos con "Hacer profesor" (cambiarRolProfesor); recién ahí se les
-- reasignan sus cursos desde el panel.
--
-- Hasta entonces `cursos.id_instructor` queda como el ÚNICO rastro de a quién
-- pertenecen esos 6 cursos. Es deuda técnica deliberada y acotada: es peor
-- dejar 6 cursos reales sin instructor visible que convivir un tiempo con una
-- tabla vestigial. El DROP de ambas va en una migración de limpieza posterior,
-- junto con las policies de supabase/sql/006_rls_instructores.sql.
--
-- `id_instructor` SÍ pasa a NULLABLE (ampliar una restricción, sin pérdida de
-- datos): `crearCurso()` ya no la escribe, y con NOT NULL todo INSERT de curso
-- nuevo fallaría.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que las
-- migraciones anteriores (P4002 por el FK de `perfiles` hacia `auth.users`,
-- que la shadow database de Prisma no conoce — ver
-- 20260825020000_tokens_vista_previa).
--
-- RLS, la vista pública `curso_instructores_publico` y la nueva versión de
-- `buscar_catalogo()` viven en supabase/sql/053_curso_instructores.sql
-- (npm run db:rls), no acá.
-- ============================================================

-- AlterTable: la especialidad se muda de `instructores` a la cuenta real.
ALTER TABLE "perfiles" ADD COLUMN "especialidad" TEXT;

-- AlterTable: ver la nota de arriba — la columna sobrevive, la obligatoriedad no.
ALTER TABLE "cursos" ALTER COLUMN "id_instructor" DROP NOT NULL;

-- CreateTable: puente curso↔profesor (perfiles), muchos-a-muchos.
CREATE TABLE "curso_instructores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_curso" UUID NOT NULL,
    "id_instructor" UUID NOT NULL,
    "creado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "curso_instructores_pkey" PRIMARY KEY ("id")
);

-- Un profesor no puede figurar dos veces en el mismo curso. Es además lo que
-- deja que el guardado del panel reinserte el set completo sin duplicar.
CREATE UNIQUE INDEX "curso_instructores_id_curso_id_instructor_key"
    ON "curso_instructores"("id_curso", "id_instructor");

-- El lado `id_curso` ya queda cubierto por el índice único de arriba (es su
-- primera columna). Este es para la consulta inversa, "los cursos de este
-- profesor", que si no haría seq scan.
CREATE INDEX "curso_instructores_id_instructor_idx"
    ON "curso_instructores"("id_instructor");

-- CASCADE: borrar un curso se lleva sus filas puente, igual que
-- `curso_categorias_id_curso_fkey`. No hay nada que conservar de una puente
-- cuyo curso ya no existe.
ALTER TABLE "curso_instructores" ADD CONSTRAINT "curso_instructores_id_curso_fkey"
    FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, mismo criterio que `comentarios_id_usuario_fkey`: eliminar la
-- cuenta de alguien que figura como profesor de un curso tiene que fallar de
-- forma ruidosa, no dejar el curso sin instructor en silencio. Se le quita
-- primero de sus cursos desde el panel.
ALTER TABLE "curso_instructores" ADD CONSTRAINT "curso_instructores_id_instructor_fkey"
    FOREIGN KEY ("id_instructor") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sin trigger `set_actualizado_en`: `curso_instructores` es una puente pura
-- (no tiene `actualizado_en`; una fila se crea o se borra, nunca se edita),
-- igual que `comentario_likes`.
