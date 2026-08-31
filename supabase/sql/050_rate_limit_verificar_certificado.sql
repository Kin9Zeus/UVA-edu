-- ============================================================
-- Rate limiting en verificar_certificado (Certificado.md: "impedir que
-- alguien enumere códigos") + endurecimiento del grant existente.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 047-049.
--
-- Mismo patrón que 023 (verificar_limite_check_email /
-- registrar_intento_check_email): función anónima, atacante elige qué
-- código probar en cada request, así que el límite va por IP, no por
-- código — limitar por código no frena nada (prueba uno distinto cada
-- vez).
--
-- Endurece verificar_certificado (015/020): hasta ahora tenía
-- `grant ... to anon, authenticated`, invocable sin límite directo contra
-- PostgREST. Con la página pública real
-- (src/app/(public)/verificar-certificado/[codigo]/page.tsx) el límite se
-- aplica ANTES de llamarla, vía el admin client (Service Role Key) — igual
-- que check_email_provider. Dejar el grant público abierto habría hecho que
-- el límite de abajo fuera decorativo: cualquiera podría seguir golpeando
-- /rest/v1/rpc/verificar_certificado directo, sin pasar por la página ni
-- por su límite.
-- ============================================================

create table if not exists private.intentos_verificar_certificado (
  ip              text primary key,
  intentos        int not null default 0,
  primer_intento  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

create or replace function public.verificar_limite_certificado(p_ip text)
returns table(permitido boolean, segundos_espera int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila private.intentos_verificar_certificado%rowtype;
begin
  select * into v_fila from private.intentos_verificar_certificado where ip = p_ip;

  if v_fila.ip is null or v_fila.bloqueado_hasta is null or v_fila.bloqueado_hasta <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, ceil(extract(epoch from (v_fila.bloqueado_hasta - now())))::int;
end;
$$;

-- 20 intentos por IP en 15 minutos: mismo límite exacto que
-- verificar_limite_check_email (023), mismo tipo de flujo anónimo.
create or replace function public.registrar_intento_verificar_certificado(p_ip text)
returns void
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila    private.intentos_verificar_certificado%rowtype;
  v_ventana interval := interval '15 minutes';
  v_limite  int := 20;
begin
  select * into v_fila from private.intentos_verificar_certificado where ip = p_ip;

  if v_fila.ip is null or now() - v_fila.primer_intento > v_ventana then
    insert into private.intentos_verificar_certificado (ip, intentos, primer_intento, bloqueado_hasta)
    values (p_ip, 1, now(), null)
    on conflict (ip) do update
      set intentos = 1, primer_intento = now(), bloqueado_hasta = null;
    return;
  end if;

  update private.intentos_verificar_certificado
  set intentos = v_fila.intentos + 1,
      bloqueado_hasta = case
        when v_fila.intentos + 1 >= v_limite then now() + v_ventana
        else null
      end
  where ip = p_ip;
end;
$$;

revoke execute on function public.verificar_limite_certificado(text) from public, anon, authenticated;
revoke execute on function public.registrar_intento_verificar_certificado(text) from public, anon, authenticated;
grant execute on function public.verificar_limite_certificado(text) to service_role;
grant execute on function public.registrar_intento_verificar_certificado(text) to service_role;

-- `from public` es lo que de verdad importa acá: toda función nueva otorga
-- EXECUTE a PUBLIC por defecto al crearse (y 020 recreó esta con `drop` +
-- `create or replace`, así que volvió a nacer con ese grant por defecto).
-- anon/authenticated son miembros implícitos de PUBLIC, así que revocarles
-- solo a ellos dos no alcanza — PUBLIC les seguiría dando el permiso por
-- detrás. Mismo motivo por el que verificar_limite_certificado y
-- registrar_intento_verificar_certificado (arriba) también revocan `public`.
revoke execute on function public.verificar_certificado(text) from public, anon, authenticated;
grant execute on function public.verificar_certificado(text) to service_role;
