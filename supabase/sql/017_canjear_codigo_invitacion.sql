-- ============================================================
-- Canje de un código de invitación
-- Ver 016_rls_codigos_invitacion.sql y auditoría de RLS.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 016.
--
-- Mismo criterio de exposición que check_email_provider (007) y
-- registrar_reenvio_verificacion (009): vive en `public` porque el
-- backend de Next.js solo puede llamarla vía supabase.rpc(...) con la
-- Service Role Key (Prisma no tiene conexión directa a Postgres,
-- CLAUDE.md §2), y PostgREST solo expone `public`. Se revoca EXECUTE
-- de PUBLIC/anon/authenticated: solo service_role puede invocarla, así
-- que el Server Action que la llama (src/actions/.../canjear-codigo.ts)
-- debe verificar la sesión real del usuario ANTES de invocarla y pasar
-- su id explícitamente — la función confía en ese parámetro porque
-- solo el backend, ya autenticado, puede alcanzarla.
--
-- Hace todo en una sola transacción con "select ... for update" sobre
-- la fila del código: valida vigencia/límite de uso, crea la
-- Suscripción e incrementa veces_usado de forma atómica, para que dos
-- canjes simultáneos del mismo código con límite de uso no lo superen
-- (condición de carrera clásica de hacerlo en varios round-trips desde
-- el cliente).
-- ============================================================

create or replace function public.canjear_codigo_invitacion(p_codigo text, p_usuario_id uuid)
returns table(ok boolean, motivo text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_codigo   public.codigos_invitacion%rowtype;
  v_plan     public.planes%rowtype;
  v_inicio   timestamptz := now();
  v_renueva  timestamptz;
begin
  select * into v_codigo
  from public.codigos_invitacion
  where codigo = p_codigo
  for update;

  if not found then
    return query select false, 'codigo_invalido';
    return;
  end if;

  if not v_codigo.activo then
    return query select false, 'codigo_inactivo';
    return;
  end if;

  if v_codigo.fecha_vencimiento < v_inicio then
    return query select false, 'codigo_vencido';
    return;
  end if;

  -- Se valida ANTES que el límite de usos: si este usuario ya lo canjeó,
  -- ese es el motivo real aunque el código también esté agotado — un
  -- reintento del mismo usuario no debería leer "se acabó" sino "ya lo
  -- usaste".
  if exists (
    select 1 from public.suscripciones
    where id_codigo_invitacion = v_codigo.id and id_usuario = p_usuario_id
  ) then
    return query select false, 'ya_canjeado';
    return;
  end if;

  if v_codigo.limite_usos is not null and v_codigo.veces_usado >= v_codigo.limite_usos then
    return query select false, 'codigo_agotado';
    return;
  end if;

  select * into v_plan from public.planes where id = v_codigo.id_plan;
  if not found then
    return query select false, 'plan_no_encontrado';
    return;
  end if;

  v_renueva := v_inicio + make_interval(days => v_plan.duracion_dias);

  insert into public.suscripciones (
    id_usuario, id_plan, fecha_inicio, fecha_renovacion, estado,
    proveedor, monto_centavos, moneda, id_codigo_invitacion,
    acceso_manual, otorgado_por
  ) values (
    p_usuario_id, v_plan.id, v_inicio, v_renueva, 'ACTIVA',
    'invitacion', 0, v_plan.moneda, v_codigo.id,
    true, v_codigo.id_admin_creador
  );

  update public.codigos_invitacion
  set veces_usado = veces_usado + 1
  where id = v_codigo.id;

  return query select true, null::text;
end;
$$;

revoke execute on function public.canjear_codigo_invitacion(text, uuid) from public;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from anon;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from authenticated;
grant execute on function public.canjear_codigo_invitacion(text, uuid) to service_role;
