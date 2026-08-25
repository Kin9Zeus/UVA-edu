-- ============================================================
-- Rate limiting en check_email_provider (enumeración de cuentas) y en
-- canjear_codigo_invitacion (fuerza bruta de códigos). Ver
-- AUDIT-2026-08-24.md, hallazgos P2-1 y P2-2.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-022.
--
-- Mismo patrón que 009/022: tabla en `private` (no expuesta por
-- PostgREST, sin RLS), funciones en `public` con EXECUTE revocado a
-- PUBLIC/anon/authenticated y otorgado solo a service_role — el
-- backend las llama vía createAdminClient() (Service Role Key,
-- src/lib/supabase/admin.ts), nunca el cliente directo.
--
-- La clave del límite es distinta en cada caso y no es intercambiable:
--   - check_email_provider es anónimo y el atacante elige el correo a
--     probar, así que limitar por correo no sirve (prueba uno distinto
--     por request). Se limita por IP.
--   - canjear_codigo_invitacion exige sesión: el atacante es un
--     usuario ya autenticado probando códigos. Su usuario_id sale de
--     auth.getUser() en el servidor, no de un valor que él controle,
--     así que limitar por usuario_id sí es confiable.
-- ============================================================

-- --------------------------------------------------------------
-- P2-1: checkEmail — máximo 20 intentos por IP en una ventana de 15
-- minutos. Sin login exitoso que limpie el contador (no existe tal
-- concepto aquí): el bloqueo simplemente expira con la ventana.
-- --------------------------------------------------------------
create table if not exists private.intentos_check_email (
  ip              text primary key,
  intentos        int not null default 0,
  primer_intento  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

create or replace function public.verificar_limite_check_email(p_ip text)
returns table(permitido boolean, segundos_espera int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila private.intentos_check_email%rowtype;
begin
  select * into v_fila from private.intentos_check_email where ip = p_ip;

  if v_fila.ip is null or v_fila.bloqueado_hasta is null or v_fila.bloqueado_hasta <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, ceil(extract(epoch from (v_fila.bloqueado_hasta - now())))::int;
end;
$$;

create or replace function public.registrar_intento_check_email(p_ip text)
returns void
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila    private.intentos_check_email%rowtype;
  v_ventana interval := interval '15 minutes';
  v_limite  int := 20;
begin
  select * into v_fila from private.intentos_check_email where ip = p_ip;

  if v_fila.ip is null or now() - v_fila.primer_intento > v_ventana then
    insert into private.intentos_check_email (ip, intentos, primer_intento, bloqueado_hasta)
    values (p_ip, 1, now(), null)
    on conflict (ip) do update
      set intentos = 1, primer_intento = now(), bloqueado_hasta = null;
    return;
  end if;

  update private.intentos_check_email
  set intentos = v_fila.intentos + 1,
      bloqueado_hasta = case
        when v_fila.intentos + 1 >= v_limite then now() + v_ventana
        else null
      end
  where ip = p_ip;
end;
$$;

revoke execute on function public.verificar_limite_check_email(text) from public, anon, authenticated;
revoke execute on function public.registrar_intento_check_email(text) from public, anon, authenticated;
grant execute on function public.verificar_limite_check_email(text) to service_role;
grant execute on function public.registrar_intento_check_email(text) to service_role;

-- --------------------------------------------------------------
-- P2-2: canjearCodigoInvitacion — máximo 5 fallos por usuario en una
-- ventana de 1 hora. Un canje exitoso limpia el contador (igual que
-- limpiar_intentos_login): un usuario que acertó no debe quedar
-- bloqueado por errores de tecleo previos.
-- --------------------------------------------------------------
create table if not exists private.intentos_canjear_codigo (
  id_usuario      uuid primary key,
  intentos        int not null default 0,
  primer_intento  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

create or replace function public.verificar_limite_canjear_codigo(p_usuario_id uuid)
returns table(permitido boolean, segundos_espera int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila private.intentos_canjear_codigo%rowtype;
begin
  select * into v_fila from private.intentos_canjear_codigo where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or v_fila.bloqueado_hasta is null or v_fila.bloqueado_hasta <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, ceil(extract(epoch from (v_fila.bloqueado_hasta - now())))::int;
end;
$$;

create or replace function public.registrar_canje_fallido(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila    private.intentos_canjear_codigo%rowtype;
  v_ventana interval := interval '1 hour';
  v_limite  int := 5;
begin
  select * into v_fila from private.intentos_canjear_codigo where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or now() - v_fila.primer_intento > v_ventana then
    insert into private.intentos_canjear_codigo (id_usuario, intentos, primer_intento, bloqueado_hasta)
    values (p_usuario_id, 1, now(), null)
    on conflict (id_usuario) do update
      set intentos = 1, primer_intento = now(), bloqueado_hasta = null;
    return;
  end if;

  update private.intentos_canjear_codigo
  set intentos = v_fila.intentos + 1,
      bloqueado_hasta = case
        when v_fila.intentos + 1 >= v_limite then now() + v_ventana
        else null
      end
  where id_usuario = p_usuario_id;
end;
$$;

create or replace function public.limpiar_intentos_canjear_codigo(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = private
as $$
begin
  delete from private.intentos_canjear_codigo where id_usuario = p_usuario_id;
end;
$$;

revoke execute on function public.verificar_limite_canjear_codigo(uuid) from public, anon, authenticated;
revoke execute on function public.registrar_canje_fallido(uuid) from public, anon, authenticated;
revoke execute on function public.limpiar_intentos_canjear_codigo(uuid) from public, anon, authenticated;
grant execute on function public.verificar_limite_canjear_codigo(uuid) to service_role;
grant execute on function public.registrar_canje_fallido(uuid) to service_role;
grant execute on function public.limpiar_intentos_canjear_codigo(uuid) to service_role;
