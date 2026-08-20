-- Soporta el flujo de "correo inteligente" (login/registro unificado, ver
-- promptauthflowplatzi.md): dado un correo, dice si ya existe una cuenta y
-- con qué proveedor(es) se creó, para que el frontend decida entre mostrar
-- "crear cuenta", "iniciar sesión", "continuar con Google" o ambas opciones
-- (`provider = 'both'`, cuenta con contraseña e identidad de Google
-- vinculadas) sin pedir nunca una contraseña que la cuenta nunca tuvo.
--
-- A diferencia de private.handle_new_user() y private.es_administrador()
-- (000/001/002), esta función SÍ necesita quedar en el schema `public`: el
-- servidor Next.js no tiene conexión Postgres directa (Prisma es solo
-- schema/migraciones, ver CLAUDE.md §2), así que solo puede llamarla vía
-- PostgREST (`supabase.rpc(...)`) con el Service Role Key, y PostgREST no
-- expone en absoluto el schema `private`. Queda igual de inalcanzable para
-- anon/authenticated: se revoca EXECUTE de PUBLIC/anon/authenticated y solo
-- se otorga a service_role, así que aunque el endpoint REST exista, Postgres
-- rechaza la llamada para cualquier JWT que no sea el del backend.
create or replace function public.check_email_provider(p_email text)
returns table(account_exists boolean, provider text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_has_google boolean;
  v_has_password boolean;
begin
  -- `encrypted_password` (no la tabla `auth.identities`) es la fuente de
  -- verdad de si la cuenta puede entrar con contraseña: Supabase solo crea
  -- una identidad `email` cuando el alta se hizo con signUp() de
  -- correo/contraseña. Una cuenta que empezó como solo-Google y luego puso
  -- contraseña (ej. vía "recuperar contraseña" o desde su perfil) llena
  -- `encrypted_password` sin crear esa fila en `identities`.
  select
    u.id,
    u.encrypted_password is not null and u.encrypted_password <> ''
  into v_user_id, v_has_password
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;

  if v_user_id is null then
    return query select false, null::text;
    return;
  end if;

  v_has_google := exists (
    select 1 from auth.identities ai
    where ai.user_id = v_user_id and ai.provider = 'google'
  );

  if v_has_google and v_has_password then
    return query select true, 'both'::text;
  elsif v_has_google then
    return query select true, 'google'::text;
  else
    return query select true, 'password'::text;
  end if;
end;
$$;

revoke execute on function public.check_email_provider(text) from public;
revoke execute on function public.check_email_provider(text) from anon;
revoke execute on function public.check_email_provider(text) from authenticated;
grant execute on function public.check_email_provider(text) to service_role;
