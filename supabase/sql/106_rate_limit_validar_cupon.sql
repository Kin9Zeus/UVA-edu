-- ============================================================
-- Rate limiting en la validación de cupones. Cierra AUDIT-2026-09-15.md — P2-1.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-105.
--
-- El problema
-- -----------
-- `buscarCuponVigente` (src/lib/pagos/cupones.ts) consulta `cupones` con
-- Service Role —es decir, saltándose el RLS de solo-administrador— con un
-- texto que escribe el usuario y sin ningún tope de intentos. Además
-- distingue "ese cupón no existe" de "ese cupón venció", así que responde
-- con precisión a la pregunta "¿este código existe?". Un usuario autenticado
-- puede recorrer el espacio de códigos a la velocidad que aguante el
-- servidor. El PENDIENTE lo dejó anotado el propio autor en el encabezado de
-- ese archivo; esto lo cierra.
--
-- Por usuario, no por IP
-- ----------------------
-- Mismo razonamiento que `intentos_canjear_codigo` (023) y opuesto al de
-- `intentos_check_email`: validar un cupón exige sesión, así que el atacante
-- es un usuario ya autenticado probando códigos, y su id sale de
-- `auth.getUser()` en el servidor — no de un valor que él controle. Limitar
-- por IP sería peor: la cambia y sigue.
--
-- 10 fallos / 15 minutos, más holgado que los 5/hora del canje
-- ------------------------------------------------------------
-- No es laxitud: en el checkout, cambiar de plan REVALIDA solo el cupón ya
-- aplicado (CheckoutContent.tsx, `elegirPlan`). Es decir, un fallo puede no
-- venir de un tecleo del estudiante, y con la ventana del canje una persona
-- legítima probando planes podría bloquearse sola. Diez intentos siguen
-- haciendo inviable el barrido a fuerza bruta, que es lo que importa.
--
-- Un uso exitoso limpia el contador, igual que `limpiar_intentos_canjear_codigo`:
-- quien acertó no debe quedar bloqueado por errores de tecleo previos.
-- ============================================================

create table if not exists private.intentos_validar_cupon (
  id_usuario      uuid primary key,
  intentos        int not null default 0,
  primer_intento  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

create or replace function public.verificar_limite_validar_cupon(p_usuario_id uuid)
returns table(permitido boolean, segundos_espera int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila private.intentos_validar_cupon%rowtype;
begin
  select * into v_fila from private.intentos_validar_cupon where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or v_fila.bloqueado_hasta is null or v_fila.bloqueado_hasta <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, ceil(extract(epoch from (v_fila.bloqueado_hasta - now())))::int;
end;
$$;

create or replace function public.registrar_validacion_cupon_fallida(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila    private.intentos_validar_cupon%rowtype;
  v_ventana interval := interval '15 minutes';
  v_limite  int := 10;
begin
  select * into v_fila from private.intentos_validar_cupon where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or now() - v_fila.primer_intento > v_ventana then
    insert into private.intentos_validar_cupon (id_usuario, intentos, primer_intento, bloqueado_hasta)
    values (p_usuario_id, 1, now(), null)
    on conflict (id_usuario) do update
      set intentos = 1, primer_intento = now(), bloqueado_hasta = null;
    return;
  end if;

  update private.intentos_validar_cupon
  set intentos = v_fila.intentos + 1,
      bloqueado_hasta = case
        when v_fila.intentos + 1 >= v_limite then now() + v_ventana
        else null
      end
  where id_usuario = p_usuario_id;
end;
$$;

create or replace function public.limpiar_intentos_validar_cupon(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = private
as $$
begin
  delete from private.intentos_validar_cupon where id_usuario = p_usuario_id;
end;
$$;

-- Mismo patrón de permisos que 023, 050 y 063: nunca invocable por el
-- cliente, solo por el backend con la Service Role Key. `from public` es lo
-- que importa — toda función nueva otorga EXECUTE a PUBLIC al crearse, y
-- anon/authenticated son miembros implícitos de PUBLIC.
revoke execute on function public.verificar_limite_validar_cupon(uuid) from public, anon, authenticated;
revoke execute on function public.registrar_validacion_cupon_fallida(uuid) from public, anon, authenticated;
revoke execute on function public.limpiar_intentos_validar_cupon(uuid) from public, anon, authenticated;
grant execute on function public.verificar_limite_validar_cupon(uuid) to service_role;
grant execute on function public.registrar_validacion_cupon_fallida(uuid) to service_role;
grant execute on function public.limpiar_intentos_validar_cupon(uuid) to service_role;

-- ------------------------------------------------------------
-- `public.limpiar_intentos_rate_limit()` (063) barre las tablas de intentos
-- caducadas y la dispara el cron de 073 / `npm run rate-limit:limpiar`.
-- Se redefine para que incluya la cuarta tabla: agregar una tabla de rate
-- limit sin sumarla a este barrido es dejarla creciendo para siempre, que es
-- exactamente el hallazgo que 063 existe para cerrar.
--
-- Se conserva todo lo demás del cuerpo de 063 tal cual, incluidos el margen
-- de un día (deliberadamente mucho mayor que cualquier ventana, para que la
-- limpieza no dependa de esas constantes) y la guarda de `bloqueado_hasta`
-- (borrar una fila con bloqueo vigente lo levantaría, justo lo contrario de
-- lo que hace esta función).
-- ------------------------------------------------------------
create or replace function public.limpiar_intentos_rate_limit()
returns table(tabla text, filas_borradas int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_margen interval := interval '1 day';
  v_check  int;
  v_cert   int;
  v_canje  int;
  v_cupon  int;
begin
  delete from private.intentos_check_email
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_check = row_count;

  delete from private.intentos_verificar_certificado
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_cert = row_count;

  delete from private.intentos_canjear_codigo
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_canje = row_count;

  delete from private.intentos_validar_cupon
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_cupon = row_count;

  return query
    select 'intentos_check_email'::text, v_check
    union all select 'intentos_verificar_certificado'::text, v_cert
    union all select 'intentos_canjear_codigo'::text, v_canje
    union all select 'intentos_validar_cupon'::text, v_cupon;
end;
$$;

revoke execute on function public.limpiar_intentos_rate_limit() from public, anon, authenticated;
grant execute on function public.limpiar_intentos_rate_limit() to service_role;
