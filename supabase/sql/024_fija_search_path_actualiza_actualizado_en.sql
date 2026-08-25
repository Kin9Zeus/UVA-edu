-- ============================================================
-- Fija search_path en private.actualiza_actualizado_en()
-- Warning del Security Advisor de Supabase: function_search_path_mutable.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-023 (o vía
-- npm run db:rls, que respeta el orden).
--
-- La función original vive en
-- prisma/migrations/20260824010000_estandariza_timestamps/migration.sql
-- (excepción al patrón de esta carpeta: se escribió ahí porque nació
-- junto con el cambio de esquema de esa migración). Este archivo la
-- reemplaza con CREATE OR REPLACE, que conserva el OID de la función
-- y por tanto no rompe ninguno de los 17 triggers `set_actualizado_en`
-- que ya la referencian — no hace falta recrear ningún trigger.
--
-- search_path = '' (vacío), no `public`: el cuerpo no referencia
-- ninguna tabla ni función calificable por schema — solo NEW (el
-- registro del propio trigger) y now(), que vive en pg_catalog y
-- Postgres busca ahí siempre, esté o no en el search_path. Vacío es
-- la opción más restrictiva que sigue funcionando.
-- ============================================================

create or replace function private.actualiza_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;
