-- ============================================================
-- Rate limiting en intentos de login y en solicitudes de
-- recuperación de contraseña (revisionLogin.md, checklist de
-- calidad senior del módulo de Auth).
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-021.
--
-- Mismo criterio que 009_reenvio_verificacion_rate_limit.sql: el
-- límite se aplica por el string de correo tal cual se recibió
-- (lowercased), sin depender de que la cuenta exista en auth.users,
-- para no filtrar existencia de cuentas por timing/comportamiento
-- distinto. Tablas en `private` (no expuestas por PostgREST, sin
-- RLS), funciones en `public` con EXECUTE revocado a
-- PUBLIC/anon/authenticated y otorgado solo a service_role — el
-- backend las llama vía createAdminClient() (Service Role Key,
-- src/lib/supabase/admin.ts), nunca el cliente directo.
-- ============================================================

-- --------------------------------------------------------------
-- LOGIN: máximo 5 intentos fallidos por correo en una ventana de
-- 15 minutos. Al quinto fallo dentro de la ventana, bloquea nuevos
-- intentos por 15 minutos más. Un login exitoso limpia el contador.
--
-- Se separan en 3 funciones (en vez de una sola) porque el flujo de
-- login.ts necesita dos momentos distintos: comprobar el bloqueo
-- ANTES de gastar la llamada a signInWithPassword, y registrar el
-- resultado DESPUÉS de conocerlo.
-- --------------------------------------------------------------
create table if not exists private.intentos_login (
  correo          text primary key,
  intentos        int not null default 0,
  primer_intento  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

create or replace function public.verificar_intentos_login(p_correo text)
returns table(permitido boolean, segundos_espera int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_correo text := lower(p_correo);
  v_fila private.intentos_login%rowtype;
begin
  select * into v_fila from private.intentos_login where correo = v_correo;

  if v_fila.correo is null or v_fila.bloqueado_hasta is null or v_fila.bloqueado_hasta <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, ceil(extract(epoch from (v_fila.bloqueado_hasta - now())))::int;
end;
$$;

create or replace function public.registrar_login_fallido(p_correo text)
returns void
language plpgsql
security definer
set search_path = private
as $$
declare
  v_correo   text := lower(p_correo);
  v_fila     private.intentos_login%rowtype;
  v_ventana  interval := interval '15 minutes';
  v_limite   int := 5;
begin
  select * into v_fila from private.intentos_login where correo = v_correo;

  -- Sin fila previa, o la última ventana ya expiró: arranca un contador
  -- nuevo en vez de seguir sumando sobre intentos viejos.
  if v_fila.correo is null or now() - v_fila.primer_intento > v_ventana then
    insert into private.intentos_login (correo, intentos, primer_intento, bloqueado_hasta)
    values (v_correo, 1, now(), null)
    on conflict (correo) do update
      set intentos = 1, primer_intento = now(), bloqueado_hasta = null;
    return;
  end if;

  update private.intentos_login
  set intentos = v_fila.intentos + 1,
      bloqueado_hasta = case
        when v_fila.intentos + 1 >= v_limite then now() + v_ventana
        else null
      end
  where correo = v_correo;
end;
$$;

-- Se llama tras un login exitoso: evita que intentos fallidos previos
-- (ej. el usuario tecleó mal la contraseña un par de veces) sigan
-- contando contra él después de haber entrado correctamente.
create or replace function public.limpiar_intentos_login(p_correo text)
returns void
language plpgsql
security definer
set search_path = private
as $$
begin
  delete from private.intentos_login where correo = lower(p_correo);
end;
$$;

revoke execute on function public.verificar_intentos_login(text) from public, anon, authenticated;
revoke execute on function public.registrar_login_fallido(text) from public, anon, authenticated;
revoke execute on function public.limpiar_intentos_login(text) from public, anon, authenticated;
grant execute on function public.verificar_intentos_login(text) to service_role;
grant execute on function public.registrar_login_fallido(text) to service_role;
grant execute on function public.limpiar_intentos_login(text) to service_role;

-- --------------------------------------------------------------
-- RECUPERACIÓN DE CONTRASEÑA: 1 solicitud por correo cada 60
-- segundos. Mismo patrón exacto que
-- 009_reenvio_verificacion_rate_limit.sql (tabla + función,
-- cooldown fijo) porque es el mismo tipo de acción: disparar un
-- correo transaccional. Cuando el límite bloquea la solicitud,
-- recuperar.ts igual responde con el mensaje neutro de siempre
-- ("si el correo existe, te llegará un enlace") — bloquear el envío
-- no debe traducirse en una respuesta distinta que delate el estado.
-- --------------------------------------------------------------
create table if not exists private.recuperacion_reenvios (
  correo text primary key,
  enviado_en timestamptz not null default now()
);

create or replace function public.registrar_solicitud_recuperacion(p_correo text)
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
  from private.recuperacion_reenvios
  where correo = v_correo;

  if v_ultimo is not null and now() - v_ultimo < interval '60 seconds' then
    return false;
  end if;

  insert into private.recuperacion_reenvios (correo, enviado_en)
  values (v_correo, now())
  on conflict (correo) do update set enviado_en = excluded.enviado_en;

  return true;
end;
$$;

revoke execute on function public.registrar_solicitud_recuperacion(text) from public, anon, authenticated;
grant execute on function public.registrar_solicitud_recuperacion(text) to service_role;
