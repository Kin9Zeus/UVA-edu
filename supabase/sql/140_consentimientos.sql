-- ============================================================
-- Prueba del consentimiento al registrarse (P1-5,
-- auditorias/AUDIT-2026-11-23.md; Decreto 1377/2013 art. 7: conservar
-- prueba de la autorización).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de la migración
-- 20261124120000_consentimientos y de 000-139.
--
-- Una fila por cosa aceptada: 'terminos', 'datos-personales' y
-- 'mayoria-de-edad'. `version_texto` es la versión de `textos_legales` (130)
-- PUBLICADA y vigente en ese momento; la busca la base, nunca el navegador,
-- para que nadie pueda declarar que aceptó una versión que no existía. Null
-- = aún no había texto publicado (o no aplica, como la mayoría de edad).
--
-- Nadie escribe por la API. Entran por dos caminos:
--   · Registro con correo: `registro` (src/actions/auth/registro.ts) manda
--     `acepta_legal: true` en los metadatos de signUp solo si las tres
--     casillas venían marcadas; el trigger de abajo, en la MISMA transacción
--     que crea el usuario, guarda las tres filas. Si falla, no hay cuenta.
--   · Registro con Google: el aviso está debajo del botón; /auth/callback
--     llama a `registrar_consentimientos_google()` para la cuenta nueva.
-- Append-only: ni UPDATE ni DELETE (la prueba no se corrige). Al suprimir
-- la cuenta el perfil se anonimiza y estas filas quedan.
-- ============================================================

do $$
begin
  alter table public.consentimientos
    add constraint consentimientos_tipo_valido
    check (tipo in ('terminos', 'datos-personales', 'mayoria-de-edad'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.consentimientos
    add constraint consentimientos_origen_valido
    check (origen in ('registro-correo', 'registro-google'));
exception
  when duplicate_object then null;
end;
$$;

-- La versión vigente de un texto legal, o null si no hay ninguna publicada.
create or replace function private.version_legal_vigente(p_slug text)
returns text
language sql
stable
security definer set search_path = public
as $$
  select version from public.textos_legales
  where slug = p_slug and estado = 'PUBLICADO' and vigente_desde <= now()
  order by vigente_desde desc
  limit 1;
$$;

revoke execute on function private.version_legal_vigente(text) from public, anon, authenticated;

create or replace function private.guardar_consentimientos(p_usuario uuid, p_origen text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.consentimientos (id_usuario, tipo, version_texto, origen)
  values
    (p_usuario, 'terminos', private.version_legal_vigente('terminos'), p_origen),
    (p_usuario, 'datos-personales', private.version_legal_vigente('datos-personales'), p_origen),
    (p_usuario, 'mayoria-de-edad', null, p_origen);
end;
$$;

revoke execute on function private.guardar_consentimientos(uuid, text) from public, anon, authenticated;

-- Registro con correo. Corre después de `on_auth_user_created` (000, que
-- crea el perfil): los triggers del mismo evento van en orden alfabético.
-- Sin la marca (Google, scripts, seed) no hace nada.
create or replace function private.consentimientos_al_registrarse()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce((new.raw_user_meta_data ->> 'acepta_legal')::boolean, false) then
    perform private.guardar_consentimientos(new.id, 'registro-correo');
  end if;
  return new;
end;
$$;

revoke execute on function private.consentimientos_al_registrarse() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_consentimientos on auth.users;
create trigger on_auth_user_created_consentimientos
  after insert on auth.users
  for each row execute function private.consentimientos_al_registrarse();

-- Registro con Google. Solo para quien entró con Google y aún no tiene
-- ninguna fila: llamarla de nuevo no duplica, y una cuenta de correo no
-- puede usarla para inventarse un consentimiento con otro origen.
create or replace function public.registrar_consentimientos_google()
returns void
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Sin sesión.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.identities where user_id = v_usuario and provider = 'google'
  ) then
    raise exception 'La cuenta no entró con Google.' using errcode = '42501';
  end if;
  if exists (select 1 from public.consentimientos where id_usuario = v_usuario) then
    return;
  end if;
  perform private.guardar_consentimientos(v_usuario, 'registro-google');
end;
$$;

revoke execute on function public.registrar_consentimientos_google() from public, anon;
grant execute on function public.registrar_consentimientos_google() to authenticated;

-- ------------------------------------------------------------
-- RLS: cada quien lee lo suyo; el administrador, todo. Sin escritura.
-- ------------------------------------------------------------
alter table public.consentimientos enable row level security;

revoke all on public.consentimientos from anon, authenticated;
grant select on public.consentimientos to authenticated;

drop policy if exists "consentimientos_select_propio" on public.consentimientos;
create policy "consentimientos_select_propio" on public.consentimientos
  for select using (
    id_usuario = (select auth.uid())
    or (select private.es_administrador())
  );
