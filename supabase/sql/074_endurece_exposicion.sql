-- ============================================================
-- Endurecimiento de superficie expuesta
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-5, D-7, D-14, D-15, D-16.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-073.
--
-- Cinco cambios pequeños, ninguno de los cuales corrige una fuga activa
-- salvo el primero. Los otros cuatro quitan filos: cosas que hoy no cortan
-- porque otra capa las tapa, y que cortarían en cuanto esa capa cambie.
-- ============================================================

-- ------------------------------------------------------------
-- D-5 (P2): `comentarios_autor_publico` deja de exponer `rol`.
--
-- La vista es SECURITY DEFINER de hecho (security_barrier sin
-- security_invoker), así que corre como su dueño y salta la RLS de
-- `perfiles`. Está concedida a `anon`. Verificado como anon:
--
--   filas | roles_expuestos                   | nombres
--     3   | ADMINISTRADOR,ESTUDIANTE,PROFESOR | Ana Ruiz (Admin) | ...
--
-- Exponer `nombre` y `pais` junto a un comentario público es la intención de
-- la vista y está bien. Exponer `rol` le entrega a cualquier visitante sin
-- sesión la lista de qué cuentas son administradoras — el primer paso de un
-- ataque dirigido de phishing o de credential stuffing.
--
-- La interfaz no necesita el rol: su único uso es
-- `autor?.rol === "PROFESOR"` (src/lib/comentarios.ts) para pintar el check
-- de instructor verificado. Un booleano derivado da exactamente eso y nada
-- más. Se renombra la columna a `es_profesor` en vez de dejar `rol` con otro
-- contenido: un consumidor que no se haya actualizado debe fallar al
-- compilar, no leer un valor que ya no significa lo mismo.
--
-- El resto de la vista queda idéntico a 061.
-- ------------------------------------------------------------
drop view if exists public.comentarios_autor_publico;
create view public.comentarios_autor_publico
with (security_barrier = true) as
select distinct
  p.id,
  p.nombre,
  (p.rol = 'PROFESOR') as es_profesor,
  p.pais
from public.perfiles p
where exists (
  select 1
  from public.comentarios c
  join public.lecciones l on l.id = c.id_leccion
  join public.modulos m on m.id = l.id_modulo
  where c.id_usuario = p.id
    and (
      private.es_administrador()
      or private.es_leccion_introductoria(c.id_leccion)
      or private.tiene_acceso_vigente_curso(m.id_curso)
    )
);

grant select on public.comentarios_autor_publico to anon, authenticated;

-- ------------------------------------------------------------
-- D-7 (P2): la bitácora se vuelve inmutable de verdad.
--
-- 069_bitacora_append_only.sql quitó las policies de UPDATE y DELETE, lo que
-- hace la tabla append-only para `anon` y `authenticated`. Pero
-- `service_role` SALTA RLS por completo, y es el cliente con el que la
-- aplicación ejecuta las operaciones administrativas
-- (src/lib/supabase/admin.ts). La garantía no cubría al único actor con
-- capacidad real de alterarla.
--
-- Un trigger sí se dispara para service_role. Es la diferencia entre "nadie
-- que nos importe puede modificarla" y "no se puede modificar".
--
-- UPDATE y DELETE se tratan distinto a propósito:
--
--   UPDATE: prohibido siempre, sin excepción. No existe razón legítima para
--           reescribir una entrada de auditoría ya escrita. Reescribir es
--           exactamente el ataque.
--
--   DELETE: prohibido salvo por una vía DECLARADA. Sí hay razones legítimas
--           para borrar —la retención de D-12, y el borrado del perfil de un
--           usuario, cuya FK id_admin es RESTRICT— y fingir lo contrario
--           obligaría a desactivar el trigger a mano, que es peor. Lo que se
--           evita es el borrado ACCIDENTAL o silencioso: hay que pasar por
--           public.purgar_bitacora_de_admin(), que es una llamada con nombre,
--           greppable y restringida a service_role.
--
-- El GUC es local a la transacción (tercer argumento de set_config = true),
-- así que no sobrevive a la llamada ni contamina la conexión del pool.
-- ------------------------------------------------------------
create or replace function private.bitacora_es_inmutable()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'bitacora_administrativa es append-only: una entrada de auditoría no se reescribe.'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  if coalesce(current_setting('uva.purga_bitacora', true), 'off') = 'on' then
    return old;
  end if;

  raise exception 'bitacora_administrativa es append-only: para borrar usa public.purgar_bitacora_de_admin().'
    using errcode = '42501';
end;
$$;

drop trigger if exists bitacora_append_only on public.bitacora_administrativa;
create trigger bitacora_append_only
  before update or delete on public.bitacora_administrativa
  for each row execute function private.bitacora_es_inmutable();

-- La única puerta de borrado. Vive en `public` porque tiene que ser
-- invocable como RPC desde supabase-js (PostgREST solo expone ese schema),
-- pero solo `service_role` la tiene concedida: ni `anon` ni `authenticated`
-- —ni un administrador con su sesión normal— pueden llamarla.
create or replace function public.purgar_bitacora_de_admin(p_id_admin uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_borradas integer;
begin
  perform set_config('uva.purga_bitacora', 'on', true);
  delete from public.bitacora_administrativa where id_admin = p_id_admin;
  get diagnostics v_borradas = row_count;
  -- Se apaga explícitamente aunque el `true` de set_config ya lo limite a
  -- esta transacción: si el llamador sigue haciendo cosas después, no debe
  -- arrastrar el permiso.
  perform set_config('uva.purga_bitacora', 'off', true);
  return v_borradas;
end;
$$;

revoke execute on function public.purgar_bitacora_de_admin(uuid) from public, anon, authenticated;
grant execute on function public.purgar_bitacora_de_admin(uuid) to service_role;

-- ------------------------------------------------------------
-- D-14 (P3): `anon` no necesita estas dos RPC.
--
-- Ambas son SECURITY DEFINER y leen auth.uid() internamente, así que para un
-- caller anónimo devuelven null — inocuo hoy. Pero están publicadas en
-- /rest/v1/rpc/ para `anon` sin ninguna razón: solo las llama el dashboard
-- del estudiante. Menor privilegio, y de paso cierra el aviso
-- 0028_anon_security_definer_function_executable del linter.
-- ------------------------------------------------------------
revoke execute on function public.curso_esta_completo(uuid) from anon;
revoke execute on function public.lecciones_completas_curso(uuid) from anon;

-- ------------------------------------------------------------
-- D-15 (P3): `instructores` deja de ser legible por todo el mundo.
--
-- La policy de 006 era `for select using (true)`: las 14 filas visibles para
-- cualquiera, incluida `id_perfil_profesor`, que es el UUID de una cuenta
-- real de `perfiles`.
--
-- Se puede cerrar del todo, no solo acotar, porque la tabla quedó vestigial:
-- desde la migración `20260903000000_multi_instructores` la relación real
-- curso→instructor vive en `curso_instructores` → `perfiles`, y
-- `cursos.id_instructor` es una columna que ya no se escribe
-- (src/actions/admin/cursos.ts:306-307). Se verificó que NADA en `src/` lee
-- `public.instructores`: los datos públicos del instructor salen de la vista
-- `curso_instructores_publico` (053). El único lector que queda es
-- scripts/rls-test.ts, con el service role.
--
-- Se deja lectura para administradores en lugar de revocarla entera porque
-- las filas siguen siendo el destino de una FK RESTRICT desde `cursos`, y
-- quien tenga que desenredar eso el día que se borre la columna necesita
-- poder verlas.
-- ------------------------------------------------------------
-- Los dos DROP: el nombre viejo (que esta migración retira) y el nombre
-- nuevo (por si este script se vuelve a correr — sin el segundo, una
-- reaplicación falla con "already exists", porque el primer DROP ya no
-- encuentra nada que borrar. Se descubrió corriendo db:rls:check dos veces
-- seguidas contra la base real.
drop policy if exists "instructores_select_publico" on public.instructores;
drop policy if exists "instructores_select_admin" on public.instructores;
create policy "instructores_select_admin" on public.instructores
  for select using ((select private.es_administrador()));

-- ------------------------------------------------------------
-- D-16 (P3): `admin_listar_usuarios` comprueba el rol.
--
-- Es SECURITY INVOKER y está concedida a `anon` y `authenticated`. Hoy no
-- filtra nada porque la RLS de `perfiles` recorta el resultado a la fila
-- propia — verificado: un estudiante recibe 1 perfil, `anon` recibe 0. No
-- hay fuga.
--
-- Pero una función llamada `admin_*` que cualquiera puede invocar es una
-- trampa cargada para el próximo cambio: el día que alguien añada a
-- `perfiles` una policy de lectura más amplia —un panel de instructores, un
-- directorio, lo que sea— esta función pasa a ser un volcado de usuarios con
-- correo, rol, estado y última actividad, paginado y con buscador incluido.
-- La comprobación explícita hace que esa dependencia no sea invisible.
--
-- Se mantiene SECURITY INVOKER a propósito: la defensa en profundidad de
-- que la RLS siga aplicando es justamente lo que hace que este cambio sea
-- barato y sin riesgo. El cuerpo es idéntico al de 054.
-- ------------------------------------------------------------
create or replace function public.admin_listar_usuarios(
  p_query text default null,
  p_desde date default null,
  p_hasta date default null,
  p_rol text default null,
  p_estado text default null,
  p_suscripcion text default null,
  p_limite integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  nombre text,
  correo text,
  rol text,
  estado text,
  fecha_registro timestamptz,
  cursos_inscritos bigint,
  suscripcion_estado text,
  suscripcion_acceso_manual boolean,
  suscripcion_tiene_codigo boolean,
  ultima_actividad timestamptz,
  total_resultados bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
-- Al pasar de `language sql` a plpgsql, los nombres de las columnas de
-- retorno (id, nombre, correo, rol, estado, ...) se vuelven VARIABLES de la
-- función. Cualquier referencia sin calificar a una columna con ese nombre
-- pasaría a resolverse contra la variable. Hoy el cuerpo califica todas, pero
-- basta que alguien añada un `where estado = ...` para romperlo en silencio.
-- Esta directiva le dice a plpgsql que ante un conflicto gane la columna,
-- que es la semántica que tenía la versión SQL.
#variable_conflict use_column
begin
  if not private.es_administrador() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      p.id,
      p.nombre,
      p.correo,
      p.rol::text as rol,
      p.estado::text as estado,
      p.creado_en as fecha_registro,
      -- UNION (no union all): un curso donde el estudiante tiene cortesía Y
      -- ya le quedó progreso guardado no debe contarse dos veces.
      (
        select count(*) from (
          select i.id_curso as id_curso from public.inscripciones i where i.id_usuario = p.id
          union
          select m.id_curso
          from public.progreso pr
          join public.lecciones l on l.id = pr.id_leccion
          join public.modulos m on m.id = l.id_modulo
          where pr.id_usuario = p.id
        ) cursos_del_usuario
      ) as cursos_inscritos,
      -- Estado EFECTIVO, no el crudo de la fila: una ACTIVA/PAST_DUE cuya
      -- fecha ya pasó se reporta como VENCIDA aunque nada en `suscripciones`
      -- la haya actualizado todavía (ver 040).
      e.estado_efectivo as suscripcion_estado,
      s.acceso_manual as suscripcion_acceso_manual,
      (s.id_codigo_invitacion is not null) as suscripcion_tiene_codigo,
      (select max(pr.actualizado_en) from public.progreso pr where pr.id_usuario = p.id) as ultima_actividad
    from public.perfiles p
    -- La suscripción "actual" NO es simplemente la más reciente por
    -- fecha_inicio. El índice parcial `suscripcion_activa_unica_por_usuario`
    -- garantiza a lo sumo UNA en ACTIVA/PAST_DUE, así que la vigente está
    -- bien definida: se prefiere esa, y solo si no existe se cae a la más
    -- reciente.
    left join lateral (
      select su.estado, su.acceso_manual, su.id_codigo_invitacion
      from public.suscripciones su
      where su.id_usuario = p.id
      order by
        (su.estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")) desc,
        su.fecha_inicio desc
      limit 1
    ) s on true
    left join lateral (
      select
        case
          when s.estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")
               and not private.suscripcion_da_acceso(p.id)
          then 'VENCIDA'
          else s.estado::text
        end as estado_efectivo
    ) e on true
    where
      (
        p_query is null or trim(p_query) = ''
        or public.normalizar_busqueda(p.correo) ilike '%' || public.normalizar_busqueda(p_query) || '%'
        or public.normalizar_busqueda(p.nombre) ilike '%' || public.normalizar_busqueda(p_query) || '%'
      )
      and (p_desde is null or p.creado_en >= p_desde::timestamptz)
      -- +1 día para que el rango sea inclusivo en el extremo superior: sin
      -- esto, "hasta el 15" excluiría a quien se registró el 15 a las 10:00.
      and (p_hasta is null or p.creado_en < (p_hasta + 1)::timestamptz)
      and (p_rol is null or p.rol::text = p_rol)
      and (p_estado is null or p.estado::text = p_estado)
      and (
        p_suscripcion is null
        or (p_suscripcion = 'SIN_SUSCRIPCION' and s.estado is null)
        -- Filtra sobre el estado EFECTIVO: si no, "Vencida" seguiría sin
        -- encontrar a quien se le venció el acceso por fecha y nunca volvió
        -- a canjear (la fila sigue en ACTIVA).
        or e.estado_efectivo = p_suscripcion
      )
  )
  select
    base.id,
    base.nombre,
    base.correo,
    base.rol,
    base.estado,
    base.fecha_registro,
    base.cursos_inscritos,
    base.suscripcion_estado,
    base.suscripcion_acceso_manual,
    base.suscripcion_tiene_codigo,
    base.ultima_actividad,
    count(*) over() as total_resultados
  from base
  -- Desempate por id: sin él, dos llamadas con distinto offset no tienen
  -- orden garantizado entre filas con el mismo creado_en y la paginación
  -- podría repetir o saltarse usuarios (misma razón que en 034).
  order by base.fecha_registro desc, base.id
  limit least(coalesce(p_limite, 25), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
