-- ============================================================
-- `perfiles.slug` y `comunidad_posts.slug`: las URLs del panel
-- (/admin/usuarios/<slug>) y de Comunidad (/dashboard/comunidad/<slug>) dejan
-- de mostrar el UUID de la fila. Mismo objetivo que los slugs de cursos y
-- lecciones (20260903010000_agrega_slug_a_cursos_y_lecciones), con una
-- diferencia que obliga a generarlo EN LA BASE y no con slugificar() de la
-- app:
--
--   - `perfiles`: la fila no la inserta la app sino el trigger
--     private.handle_new_user() al registrarse (supabase/sql/000, 002). Un
--     slug calculado en TypeScript llegaría tarde.
--   - `comunidad_posts`: la inserta el propio estudiante con su sesión, y RLS
--     no le deja ver las publicaciones eliminadas — no podría saber si su
--     slug choca con una de ellas. La comprobación va en una función
--     SECURITY DEFINER.
--
-- REGLAS
-- ------
--   perfiles.slug         Sale de `nombre` y SE REGENERA si el nombre cambia.
--                         Son URLs internas del panel: manda que coincidan con
--                         el nombre visible. Consecuencia buscada: al anonimizar
--                         una cuenta (075, nombre = 'Usuario eliminado') el slug
--                         deja de contener el nombre real sin tocar ese script.
--   comunidad_posts.slug  Sale de `titulo` al publicar y NO cambia al editar el
--                         título (087): el enlace a un hilo se comparte, y
--                         corregir una tilde no debe romperlo.
--
--   Nadie escribe el slug a mano: los triggers descartan cualquier valor que
--   venga en el INSERT o el UPDATE.
--
-- Todo en una sola migración (columna + relleno + triggers + NOT NULL): si el
-- NOT NULL existiera un instante sin el trigger, cualquier registro nuevo
-- fallaría.
--
-- Normalización: misma que las migraciones de slug anteriores (`unaccent` no
-- está habilitada, así que los diacríticos del español se traducen a mano) y
-- que slugificar() de src/lib/slug.ts, incluido el sufijo -2, -3… de
-- slugDisponible().
-- ============================================================

-- ---------- Funciones ----------

CREATE OR REPLACE FUNCTION private.slugificar(texto text, respaldo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT left(
    COALESCE(
      NULLIF(
        regexp_replace(
          regexp_replace(
            lower(
              translate(
                COALESCE(texto, ''),
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
      respaldo
    ),
    60
  );
$$;

-- Primer slug libre a partir de `base` en `tabla`, ignorando la propia fila.
--
-- SECURITY DEFINER porque tiene que ver TODAS las filas (también las que RLS le
-- oculta a quien inserta) para no chocar con el índice único. El candado
-- consultivo serializa a dos inserciones simultáneas con la misma base: sin él,
-- las dos verían libre el mismo slug y una fallaría con 23505 — en `perfiles`
-- eso sería un registro de cuenta caído.
CREATE OR REPLACE FUNCTION private.slug_libre(tabla regclass, base text, excepto uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidato text := base;
  sufijo integer := 1;
  ocupado boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(tabla::text || ':' || base, 0));
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE slug = $1 AND id IS DISTINCT FROM $2)', tabla)
      INTO ocupado
      USING candidato, excepto;
    EXIT WHEN NOT ocupado;
    sufijo := sufijo + 1;
    candidato := left(base, 60 - length(sufijo::text) - 1) || '-' || sufijo;
  END LOOP;
  RETURN candidato;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.slug_libre(regclass, text, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.perfiles_asigna_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nombre IS NOT DISTINCT FROM OLD.nombre THEN
    NEW.slug := OLD.slug;
  ELSE
    NEW.slug := private.slug_libre('public.perfiles', private.slugificar(NEW.nombre, 'usuario'), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.comunidad_posts_asigna_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.slug := OLD.slug;
  ELSE
    NEW.slug := private.slug_libre(
      'public.comunidad_posts',
      private.slugificar(NEW.titulo, 'publicacion'),
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.perfiles_asigna_slug() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.comunidad_posts_asigna_slug() FROM PUBLIC;

-- ---------- Columnas y relleno ----------
--
-- Los triggers de usuario se apagan durante el relleno: el UPDATE toca todas
-- las filas, y `set_actualizado_en` marcaría como "editadas hoy" todas las
-- cuentas y publicaciones existentes.

ALTER TABLE "perfiles" ADD COLUMN "slug" TEXT;
ALTER TABLE "comunidad_posts" ADD COLUMN "slug" TEXT;

ALTER TABLE "perfiles" DISABLE TRIGGER USER;

WITH numeradas AS (
  SELECT
    "id",
    private.slugificar("nombre", 'usuario') AS base,
    row_number() OVER (
      PARTITION BY private.slugificar("nombre", 'usuario')
      ORDER BY "creado_en", "id"
    ) AS n
  FROM "perfiles"
)
UPDATE "perfiles" p
SET "slug" = CASE WHEN nm.n = 1 THEN nm.base ELSE left(nm.base, 60 - length(nm.n::text) - 1) || '-' || nm.n END
FROM numeradas nm
WHERE p."id" = nm."id";

ALTER TABLE "perfiles" ENABLE TRIGGER USER;

ALTER TABLE "comunidad_posts" DISABLE TRIGGER USER;

WITH numeradas AS (
  SELECT
    "id",
    private.slugificar("titulo", 'publicacion') AS base,
    row_number() OVER (
      PARTITION BY private.slugificar("titulo", 'publicacion')
      ORDER BY "creado_en", "id"
    ) AS n
  FROM "comunidad_posts"
)
UPDATE "comunidad_posts" c
SET "slug" = CASE WHEN nm.n = 1 THEN nm.base ELSE left(nm.base, 60 - length(nm.n::text) - 1) || '-' || nm.n END
FROM numeradas nm
WHERE c."id" = nm."id";

ALTER TABLE "comunidad_posts" ENABLE TRIGGER USER;

ALTER TABLE "perfiles" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "perfiles_slug_key" ON "perfiles"("slug");

ALTER TABLE "comunidad_posts" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "comunidad_posts_slug_key" ON "comunidad_posts"("slug");

-- ---------- Triggers ----------

DROP TRIGGER IF EXISTS perfiles_asigna_slug ON public.perfiles;
CREATE TRIGGER perfiles_asigna_slug
  BEFORE INSERT OR UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION private.perfiles_asigna_slug();

DROP TRIGGER IF EXISTS comunidad_posts_asigna_slug ON public.comunidad_posts;
CREATE TRIGGER comunidad_posts_asigna_slug
  BEFORE INSERT OR UPDATE ON public.comunidad_posts
  FOR EACH ROW EXECUTE FUNCTION private.comunidad_posts_asigna_slug();
