-- ============================================================
-- Rate limiting en la generación de exámenes con IA. Cierra AUDIT-2026-09-15.md — P3-9.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-106.
--
-- El problema
-- -----------
-- `generarExamenDelCurso` (src/actions/admin/generacionExamen.ts) ya impide
-- DOS corridas simultáneas del MISMO curso (índice parcial único en
-- `trabajos_generacion_examen`), pero nada impide que un administrador —o
-- una sesión de administrador comprometida— dispare generaciones en loop
-- contra muchos cursos distintos, uno detrás de otro. Cada corrida es una
-- llamada real a Gemini (`GEMINI_API_KEY`, docs/technical-spec.md §... y
-- README) que cuesta dinero y tarda minutos; sin tope, el gasto escala con
-- la cantidad de cursos, no con ninguna acción deliberada del negocio.
--
-- Por usuario, no por IP — mismo razonamiento que `intentos_validar_cupon`
-- (106): la acción exige sesión de administrador, así que el actor es
-- siempre un `auth.uid()` conocido del lado del servidor, nunca un valor que
-- controle el cliente.
--
-- Por qué cuenta TODA generación disparada, no solo fallos
-- ----------------------------------------------------------
-- A diferencia de `intentos_validar_cupon`/`intentos_check_email` (que
-- cuentan intentos FALLIDOS, porque el riesgo es fuerza bruta), acá el
-- costo lo genera la llamada a Gemini en sí, sin importar si el resultado
-- fue éxito o error del modelo. `registrar_generacion_examen` se llama una
-- vez por cada corrida que de verdad se reclama (después de pasar los
-- checks de "ya generado"/"ya hay una en curso" en
-- generarExamenDelCurso), nunca antes.
--
-- 15 generaciones / hora por administrador
-- -----------------------------------------
-- Generoso a propósito: un admin ajustando transcripciones y regenerando
-- varias veces mientras prueba no debe bloquearse solo. Sigue acotando el
-- caso que importa — un loop automatizado— a un gasto máximo predecible.
-- No hay "limpiar en éxito" (a diferencia de 106): esto no es un candado
-- contra errores de tecleo, es un tope de uso, así que una corrida exitosa
-- no debe resetear el contador de las demás.
-- ============================================================

create table if not exists private.intentos_generar_examen (
  id_usuario      uuid primary key,
  intentos        int not null default 0,
  primer_intento  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

create or replace function public.verificar_limite_generar_examen(p_usuario_id uuid)
returns table(permitido boolean, segundos_espera int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila private.intentos_generar_examen%rowtype;
begin
  select * into v_fila from private.intentos_generar_examen where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or v_fila.bloqueado_hasta is null or v_fila.bloqueado_hasta <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, ceil(extract(epoch from (v_fila.bloqueado_hasta - now())))::int;
end;
$$;

create or replace function public.registrar_generacion_examen(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila    private.intentos_generar_examen%rowtype;
  v_ventana interval := interval '1 hour';
  v_limite  int := 15;
begin
  select * into v_fila from private.intentos_generar_examen where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or now() - v_fila.primer_intento > v_ventana then
    insert into private.intentos_generar_examen (id_usuario, intentos, primer_intento, bloqueado_hasta)
    values (p_usuario_id, 1, now(), null)
    on conflict (id_usuario) do update
      set intentos = 1, primer_intento = now(), bloqueado_hasta = null;
    return;
  end if;

  update private.intentos_generar_examen
  set intentos = v_fila.intentos + 1,
      bloqueado_hasta = case
        when v_fila.intentos + 1 >= v_limite then now() + v_ventana
        else null
      end
  where id_usuario = p_usuario_id;
end;
$$;

-- Mismo patrón de permisos que 023/050/063/106: nunca invocable por el
-- cliente, solo por el backend con la Service Role Key.
revoke execute on function public.verificar_limite_generar_examen(uuid) from public, anon, authenticated;
revoke execute on function public.registrar_generacion_examen(uuid) from public, anon, authenticated;
grant execute on function public.verificar_limite_generar_examen(uuid) to service_role;
grant execute on function public.registrar_generacion_examen(uuid) to service_role;

-- ------------------------------------------------------------
-- Suma la quinta tabla a `public.limpiar_intentos_rate_limit()` (063,
-- redefinida por 106) — mismo motivo que ahí: una tabla de rate limit sin
-- barrido queda creciendo para siempre.
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
  v_examen int;
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

  delete from private.intentos_generar_examen
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_examen = row_count;

  return query
    select 'intentos_check_email'::text, v_check
    union all select 'intentos_verificar_certificado'::text, v_cert
    union all select 'intentos_canjear_codigo'::text, v_canje
    union all select 'intentos_validar_cupon'::text, v_cupon
    union all select 'intentos_generar_examen'::text, v_examen;
end;
$$;

revoke execute on function public.limpiar_intentos_rate_limit() from public, anon, authenticated;
grant execute on function public.limpiar_intentos_rate_limit() to service_role;
