-- ============================================================
-- Rate limit del reenvío de verificación de correo (Flujo 02, ampliación)
-- Ver docs/functional-spec.md Flujo 02 y docs/technical-spec.md §6.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-008.
--
-- Usada por src/actions/auth/reenviar-verificacion.ts, vía
-- createAdminClient() (Service Role Key). Limita a 1 reenvío del correo
-- "Confirm signup" cada 60 segundos por dirección.
-- ============================================================

-- No expuesta por PostgREST (schema `private`) y sin RLS: solo la toca la
-- función de abajo, en el mismo transaction/contexto SECURITY DEFINER.
create table if not exists private.verificacion_reenvios (
  correo text primary key,
  enviado_en timestamptz not null default now()
);

-- Igual que public.check_email_provider() (007_check_email_provider.sql):
-- vive en `public` porque el backend de Next.js solo puede llamarla vía
-- supabase.rpc(...) con la Service Role Key (Prisma no tiene conexión
-- directa a Postgres, CLAUDE.md §2), y PostgREST solo expone `public`.
-- Queda igual de inalcanzable para anon/authenticated: se revoca EXECUTE
-- de PUBLIC/anon/authenticated y solo se otorga a service_role.
--
-- No depende de que la cuenta exista en auth.users — el límite se aplica
-- por el string de correo tal cual se recibió, para no filtrar
-- existencia de cuentas por timing (mismo criterio anti-enumeración que
-- recuperar.ts).
create or replace function public.registrar_reenvio_verificacion(p_correo text)
returns boolean
language plpgsql
security definer
set search_path = private
as $$
declare
  v_correo text := lower(p_correo);
  v_ultimo timestamptz;
begin
  select enviado_en into v_ultimo
  from private.verificacion_reenvios
  where correo = v_correo;

  if v_ultimo is not null and now() - v_ultimo < interval '60 seconds' then
    return false;
  end if;

  insert into private.verificacion_reenvios (correo, enviado_en)
  values (v_correo, now())
  on conflict (correo) do update set enviado_en = excluded.enviado_en;

  return true;
end;
$$;

revoke execute on function public.registrar_reenvio_verificacion(text) from public;
revoke execute on function public.registrar_reenvio_verificacion(text) from anon;
revoke execute on function public.registrar_reenvio_verificacion(text) from authenticated;
grant execute on function public.registrar_reenvio_verificacion(text) to service_role;
