-- ============================================================
-- El poder de administrador exige sesión aal2 (contraseña + código de la app
-- de autenticación) — FASE 8.1 del plan de blindaje.
--
-- Orden de aplicación: DESPUÉS de 000-130.
--
-- Por qué aquí y no solo en la app
-- --------------------------------
-- La app ya exige aal2 en el layout de /admin, en requireAdmin() y en los
-- puntos que dan poder de administrador por su cuenta. Pero la llave pública
-- de Supabase está en el navegador: alguien con la CONTRASEÑA de un
-- administrador puede iniciar sesión directo contra Supabase, sin pasar por la
-- app, y consultar la API con ese token. Sin este archivo, RLS le daría todo:
-- el padrón de usuarios, la bitácora, el CMS. El segundo factor solo protege
-- de verdad si la base también lo exige.
--
-- Qué cambia
-- ----------
-- 1. `private.es_administrador()` responde true solo si la sesión es aal2.
--    Esa función la usan cientos de políticas y todas las funciones de admin
--    (`admin_listar_usuarios`, `crear_lote_codigos_invitacion`,
--    `anonimizar_usuario`...): todas heredan la regla sin tocarlas.
--
-- 2. `private.comunidad_tiene_acceso(p_id_usuario)` tenía su propio atajo de
--    administrador (084) que no pasa por la función de arriba. Se le exige
--    aal2 SOLO cuando se pregunta por la sesión en curso: el trigger de
--    anuncios (095) la llama con el id de OTRAS personas para decidir a quién
--    notificar, y ahí el nivel de quien publica no dice nada sobre ellas.
--
-- Un administrador con sesión aal1 sigue siendo, para RLS, una persona normal:
-- ve su perfil, su progreso y lo que le daría su propia suscripción. Es lo que
-- necesita la pantalla /seguridad/activar para dejarlo registrar su app.
--
-- service_role no se ve afectado: no tiene `auth.uid()`, así que
-- `es_administrador()` ya era false para él, y RLS no lo filtra.
--
-- `auth.jwt()` va envuelto en `(select …)` por el mismo motivo que
-- `auth.uid()` en 105/113: Postgres lo evalúa una vez por consulta y no una vez
-- por fila.
-- ============================================================

create or replace function private.es_administrador()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1 from public.perfiles
      where id = (select auth.uid()) and rol = 'ADMINISTRADOR'
    );
$$;

create or replace function private.comunidad_tiene_acceso(p_id_usuario uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    (
      exists (
        select 1 from public.perfiles
        where id = p_id_usuario and rol = 'ADMINISTRADOR'
      )
      and (
        p_id_usuario is distinct from (select auth.uid())
        or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      )
    )
    or private.suscripcion_da_acceso(p_id_usuario);
$$;

revoke execute on function private.comunidad_tiene_acceso(uuid) from public;
grant execute on function private.comunidad_tiene_acceso(uuid) to authenticated;
