-- ============================================================
-- TABLA DE USUARIOS DEL PANEL: BÚSQUEDA, FILTROS Y PAGINACIÓN EN SERVIDOR
--
-- RevUsuariof4, requisitos de calidad: "las agregaciones se calculan en
-- Postgres, no trayendo todas las filas al cliente" y "paginación en la
-- tabla de usuarios desde el inicio".
--
-- Qué reemplaza: getUsuarios() (src/lib/admin/usuarios.ts) traía TODAS las
-- filas de perfiles, suscripciones e inscripciones y las cruzaba con Map en
-- JavaScript — tres escaneos completos por carga de página, sin paginación.
--
-- Mismo patrón que buscar_catalogo (034), que ya resolvió este problema para
-- el catálogo público: `count(*) over()` para no hacer una segunda consulta
-- de total, `security invoker`, y desempate estable en el ORDER BY.
--
-- security invoker (el default; NO poner SECURITY DEFINER)
-- -------------------------------------------------------
-- Esta función devuelve nombre y correo de los usuarios. Corre con los
-- permisos de quien llama, así que la RLS de `perfiles` sigue aplicando:
-- un administrador ve el padrón (política `perfiles_select_propio` incluye
-- `private.es_administrador()`), y un estudiante que la invoque directamente
-- por POST solo ve su propia fila.
--
-- Convertirla a SECURITY DEFINER la transformaría en una fuga del padrón
-- completo hacia cualquier usuario autenticado. No hacerlo, tampoco "para
-- que el admin no dependa de la política".
--
-- Los filtros de rol/estado/suscripción viven aquí y no en el cliente: con
-- paginación en servidor, filtrar en memoria operaría solo sobre la página
-- visible y daría resultados falsos (filtrar por "suspendido" mostraría los
-- suspendidos de 25 usuarios, no de todos).
-- ============================================================

-- Búsqueda con ILIKE '%texto%' sobre correo Y nombre. `perfiles_correo_key`
-- es un btree UNIQUE: sirve para igualdad y prefijo, pero NO para coincidencia
-- a mitad de cadena. Hacen falta índices de trigramas, igual que en 034.
--
-- El nombre se indexa además del correo porque el buscador del header dice
-- "Buscar por nombre o correo" y la tabla filtraba por ambos cuando el
-- filtrado vivía en el cliente. RevUsuariof4 solo exige el correo, pero
-- quitar la búsqueda por nombre al mover el filtro al servidor habría sido
-- una regresión silenciosa con el placeholder prometiéndola.
--
-- Sin CONCURRENTLY: scripts/apply-rls.ts corre todo el lote dentro de una
-- sola transacción y CREATE INDEX CONCURRENTLY no es transaccionable. Mismo
-- criterio que los índices GIN de 034.
drop index if exists public.perfiles_correo_trgm_idx;
create index perfiles_correo_trgm_idx
  on public.perfiles using gin (public.normalizar_busqueda(correo) gin_trgm_ops);

drop index if exists public.perfiles_nombre_trgm_idx;
create index perfiles_nombre_trgm_idx
  on public.perfiles using gin (public.normalizar_busqueda(nombre) gin_trgm_ops);

-- El ORDER BY y el filtro de rango de fechas van sobre `creado_en`, que no
-- tenía índice.
drop index if exists public.perfiles_creado_en_idx;
create index perfiles_creado_en_idx on public.perfiles using btree (creado_en desc);

-- Métrica de actividad de los últimos 7 días (vista metricas_panel_usuarios)
-- y columna "última actividad" de esta función.
drop index if exists public.progreso_actualizado_en_idx;
create index progreso_actualizado_en_idx on public.progreso using btree (actualizado_en desc);

-- ------------------------------------------------------------
-- admin_listar_usuarios
--
-- p_query        búsqueda por correo o nombre (insensible a mayúsculas y tildes)
-- p_desde/p_hasta  rango sobre la fecha de registro (perfiles.creado_en)
-- p_rol / p_estado / p_suscripcion  filtros de la tabla; null = todos
-- p_limite/p_offset  paginación
--
-- No devuelve `celular`: la lista no expone datos personales que no necesita
-- (RevUsuariof4), y el detalle se consulta al abrir el usuario. Que la
-- columna no aparezca aquí es la salvaguarda, no una omisión accidental.
--
-- p_limite lleva tope duro: la función es alcanzable por POST directo y sin
-- límite un solo llamado pediría el padrón entero.
-- ------------------------------------------------------------
create or replace function public.admin_listar_usuarios(
  p_query text default null,
  p_desde date default null,
  p_hasta date default null,
  p_rol text default null,
  p_estado text default null,
  p_suscripcion text default null,
  p_limite int default 25,
  p_offset int default 0
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
language sql
stable
set search_path = public, extensions
as $$
  with base as (
    select
      p.id,
      p.nombre,
      p.correo,
      p.rol::text as rol,
      p.estado::text as estado,
      p.creado_en as fecha_registro,
      (select count(*) from public.inscripciones i where i.id_usuario = p.id) as cursos_inscritos,
      -- La suscripción "actual" NO es simplemente la más reciente por
      -- fecha_inicio. El índice parcial `suscripcion_activa_unica_por_usuario`
      -- garantiza a lo sumo UNA en ACTIVA/PAST_DUE, así que la vigente está
      -- bien definida: se prefiere esa, y solo si no existe se cae a la más
      -- reciente. Ordenar solo por fecha dejaría a alguien con una ACTIVA
      -- antigua y una VENCIDA posterior marcado como "vencido" en la tabla
      -- mientras la vista de métricas lo cuenta como vigente — el panel
      -- contradiciéndose consigo mismo.
      s.estado::text as suscripcion_estado,
      s.acceso_manual as suscripcion_acceso_manual,
      (s.id_codigo_invitacion is not null) as suscripcion_tiene_codigo,
      (select max(pr.actualizado_en) from public.progreso pr where pr.id_usuario = p.id) as ultima_actividad
    from public.perfiles p
    left join lateral (
      select su.estado, su.acceso_manual, su.id_codigo_invitacion
      from public.suscripciones su
      where su.id_usuario = p.id
      order by
        (su.estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")) desc,
        su.fecha_inicio desc
      limit 1
    ) s on true
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
        or s.estado::text = p_suscripcion
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
$$;

grant execute on function public.admin_listar_usuarios(text, date, date, text, text, text, int, int)
  to authenticated;
