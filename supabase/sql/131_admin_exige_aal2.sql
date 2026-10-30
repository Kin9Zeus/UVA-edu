-- ============================================================
-- El poder de administrador exige un segundo factor reciente: sesión aal2
-- (contraseña + código de la app de autenticación) con el código escrito hace
-- menos de 12 horas — FASE 8.1 y 8.3 (tarea 4) del plan de blindaje.
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
-- Por qué con límite de horas
-- ---------------------------
-- Una sesión de Supabase no caduca sola, y el cierre por inactividad es de
-- plan de pago. Sin límite, una cookie de sesión robada a un administrador
-- valdría para siempre. Pasadas 12 horas desde el código, la base deja de
-- tratarlo como administrador y la app lo manda a escribirlo de nuevo. El
-- límite es el mismo que en la app (HORAS_MAXIMAS_SEGUNDO_FACTOR en
-- src/lib/auth/aal.ts); una prueba exige que coincidan.
--
-- Qué cambia
-- ----------
-- 1. `private.segundo_factor_vigente()` (nueva): sesión aal2 con el código de
--    la app escrito hace menos de 12 horas, según el claim `amr` del token.
--    Si `amr` viene en el formato del RFC 8176 (solo nombres, sin hora), no
--    hay hora que medir y solo se exige aal2: tratarlo como caducado dejaría a
--    los administradores en un bucle de pedir el código. Igual en la app.
--
-- 2. `private.es_administrador()` responde true solo con segundo factor
--    vigente. Esa función la usan cientos de políticas y todas las funciones
--    de admin (`admin_listar_usuarios`, `crear_lote_codigos_invitacion`,
--    `anonimizar_usuario`...): todas heredan la regla sin tocarlas.
--
-- 3. `private.comunidad_tiene_acceso(p_id_usuario)` tenía su propio atajo de
--    administrador (084) que no pasa por la función de arriba. Se le exige el
--    segundo factor SOLO cuando se pregunta por la sesión en curso: el trigger
--    de anuncios (095) la llama con el id de OTRAS personas para decidir a
--    quién notificar, y ahí la sesión de quien publica no dice nada sobre ellas.
--
-- Un administrador sin segundo factor vigente sigue siendo, para RLS, una
-- persona normal: ve su perfil, su progreso y lo que le daría su propia
-- suscripción. Es lo que necesitan /seguridad/activar y /seguridad/verificar
-- para dejarlo registrar su app o escribir el código.
--
-- service_role no se ve afectado: no tiene `auth.uid()`, así que
-- `es_administrador()` ya era false para él, y RLS no lo filtra.
-- ============================================================

create or replace function private.segundo_factor_vigente()
returns boolean
language sql
stable
set search_path = public
as $$
  with token as (
    select
      coalesce(auth.jwt() ->> 'aal', '') as aal,
      case
        when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr'
        else '[]'::jsonb
      end as amr
  )
  select
    token.aal = 'aal2'
    and (
      -- Formato RFC 8176: solo nombres, sin hora. No se puede medir el tiempo.
      (
        jsonb_array_length(token.amr) > 0
        and not exists (
          select 1 from jsonb_array_elements(token.amr) as metodo
          where jsonb_typeof(metodo) <> 'string'
        )
      )
      -- Formato de Supabase: el código de la app (`totp`) con su hora.
      or exists (
        select 1 from jsonb_array_elements(token.amr) as metodo
        where jsonb_typeof(metodo) = 'object'
          and metodo ->> 'method' = 'totp'
          and (metodo ->> 'timestamp') ~ '^[0-9]+$'
          and (metodo ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 43200
      )
    )
  from token;
$$;

create or replace function private.es_administrador()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    private.segundo_factor_vigente()
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
        or private.segundo_factor_vigente()
      )
    )
    or private.suscripcion_da_acceso(p_id_usuario);
$$;

revoke execute on function private.comunidad_tiene_acceso(uuid) from public;
grant execute on function private.comunidad_tiene_acceso(uuid) to authenticated;
