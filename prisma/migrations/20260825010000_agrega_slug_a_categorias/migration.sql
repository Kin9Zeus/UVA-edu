-- ============================================================
-- `categorias.slug`: identificador estable y legible para las URLs del
-- catálogo (/catalogo/diseno-parametrico en vez de /catalogo/<uuid>).
--
-- Se genera desde el nombre normalizando tildes, eñes y espacios, y es
-- UNIQUE: dos categorías no pueden compartir URL. La aplicación genera el
-- slug con slugificar() de src/lib/slug.ts — este bloque solo hace el
-- relleno inicial de las filas que ya existen, con la misma regla.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- las migraciones anteriores (P4002 por el FK de perfiles hacia auth.users).
-- ============================================================

ALTER TABLE "categorias" ADD COLUMN "slug" TEXT;

-- La extensión `unaccent` no está habilitada en el proyecto, así que los
-- diacríticos del español se traducen a mano. Es el mismo juego de
-- caracteres que cubre la normalización NFD de slugificar() en la app: acá
-- se enumeran porque Postgres no expone el equivalente sin la extensión.
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
                  "nombre",
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
        'categoria'
      ),
      60
    ) AS base
  FROM "categorias"
),
-- Dos nombres distintos pueden colapsar al mismo slug ("Diseño" y
-- "diseno"). El más antiguo se queda con el slug limpio y los demás reciben
-- un sufijo numérico, para que el UNIQUE de abajo no falle al aplicarse.
numeradas AS (
  SELECT
    "id",
    "base",
    row_number() OVER (PARTITION BY "base" ORDER BY "creado_en", "id") AS n
  FROM bases
)
UPDATE "categorias" c
SET "slug" = CASE WHEN nm.n = 1 THEN nm."base" ELSE nm."base" || '-' || nm.n END
FROM numeradas nm
WHERE c."id" = nm."id";

ALTER TABLE "categorias" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");
