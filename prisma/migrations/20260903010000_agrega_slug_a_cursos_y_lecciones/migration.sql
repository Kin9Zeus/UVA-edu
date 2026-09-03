-- ============================================================
-- `cursos.slug` y `lecciones.slug`: identificador legible para las URLs
-- públicas del curso y sus lecciones (/cursos/render-fotorrealista-con-v-ray
-- /sol-cielo-y-hdri en vez de /cursos/<uuid>/<uuid>). Mismo patrón que
-- `categorias.slug` (20260825010000_agrega_slug_a_categorias): la app genera
-- el slug con slugificar() de src/lib/slug.ts, este bloque solo rellena las
-- filas que ya existen, con la misma regla.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- 20260825010000 (la extensión `unaccent` no está habilitada, así que los
-- diacríticos del español se traducen a mano).
--
-- `cursos.slug` es UNIQUE (un curso, una URL). `lecciones.slug` NO lleva
-- índice UNIQUE de Postgres: la tabla no tiene `id_curso` directo (solo vía
-- `modulos.id_curso`), y el slug de una lección solo necesita ser único
-- DENTRO de su curso, no globalmente — dos cursos distintos pueden
-- perfectamente repetir "introduccion". La app garantiza esa unicidad por
-- curso al generarlo (ver actions/admin/cursos.ts).
-- ============================================================

ALTER TABLE "cursos" ADD COLUMN "slug" TEXT;
ALTER TABLE "lecciones" ADD COLUMN "slug" TEXT;

WITH bases AS (
  SELECT
    "id",
    "creado_en",
    left(
      COALESCE(
        NULLIF(
          regexp_replace(
            regexp_replace(
              lower(
                translate(
                  "titulo",
                  'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                  'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
                )
              ),
              '[^a-z0-9]+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
          ),
          ''
        ),
        'curso'
      ),
      60
    ) AS base
  FROM "cursos"
),
numeradas AS (
  SELECT
    "id",
    "base",
    row_number() OVER (PARTITION BY "base" ORDER BY "creado_en", "id") AS n
  FROM bases
)
UPDATE "cursos" c
SET "slug" = CASE WHEN nm.n = 1 THEN nm."base" ELSE nm."base" || '-' || nm.n END
FROM numeradas nm
WHERE c."id" = nm."id";

ALTER TABLE "cursos" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "cursos_slug_key" ON "cursos"("slug");

-- Lecciones: la unicidad se particiona por curso (vía el módulo), no
-- globalmente — ver nota de arriba.
WITH leccion_curso AS (
  SELECT l."id", l."titulo", l."creado_en", m."id_curso"
  FROM "lecciones" l
  JOIN "modulos" m ON m."id" = l."id_modulo"
),
bases AS (
  SELECT
    "id",
    "id_curso",
    "creado_en",
    left(
      COALESCE(
        NULLIF(
          regexp_replace(
            regexp_replace(
              lower(
                translate(
                  "titulo",
                  'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                  'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
                )
              ),
              '[^a-z0-9]+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
          ),
          ''
        ),
        'clase'
      ),
      60
    ) AS base
  FROM leccion_curso
),
numeradas AS (
  SELECT
    "id",
    "base",
    row_number() OVER (PARTITION BY "id_curso", "base" ORDER BY "creado_en", "id") AS n
  FROM bases
)
UPDATE "lecciones" l
SET "slug" = CASE WHEN nm.n = 1 THEN nm."base" ELSE nm."base" || '-' || nm.n END
FROM numeradas nm
WHERE l."id" = nm."id";

ALTER TABLE "lecciones" ALTER COLUMN "slug" SET NOT NULL;
