-- ============================================================
-- Row Level Security: curso_instructores + exposición pública del profesor
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-052, y
-- después de correr la migración de Prisma que crea `curso_instructores` y
-- `perfiles.especialidad` (prisma/migrations/20260903000000_multi_instructores).
--
-- Qué cambia
-- ----------
-- Instructor y Profesor pasan a ser la misma entidad: quién dicta un curso ya
-- no es `cursos.id_instructor -> instructores`, sino 1 o más filas en
-- `curso_instructores` apuntando a `perfiles` con rol PROFESOR.
--
-- `006_rls_instructores.sql` NO se toca (nunca se edita una migración RLS ya
-- aplicada): sus policies siguen ahí, simplemente dejan de usarse porque
-- ninguna capa de la app vuelve a leer ni escribir `instructores`. Se limpian
-- junto con el DROP de la tabla en la migración de limpieza futura.
-- ============================================================

-- ------------------------------------------------------------
-- CURSO_INSTRUCTORES
--
-- ENABLE explícito, no opcional: una tabla creada después de
-- `001_rls_policies.sql` nace SIN row level security, o sea legible y
-- escribible por `anon` a través de PostgREST.
--
-- SELECT: exactamente el mismo criterio que `curso_categorias_select_publico`
-- (última versión: 030_acceso_curso_despublicado.sql). No basta con
-- `cursos.mostrado = true`: un estudiante con cortesía —o con membresía y
-- progreso ya guardado— tiene derecho a seguir viendo un curso despublicado
-- (Revcurso), y si esta tabla se quedara en "solo publicados" ese curso le
-- aparecería sin instructor. Una regla, no dos.
--
-- Escritura: solo ADMINISTRADOR. Separada del SELECT en policies por comando
-- en vez de un `for all` (mismo criterio que 014_separa_politicas_for_all.sql).
-- ------------------------------------------------------------

alter table public.curso_instructores enable row level security;

drop policy if exists "curso_instructores_select_publico" on public.curso_instructores;
create policy "curso_instructores_select_publico" on public.curso_instructores
  for select using (
    exists (
      select 1 from public.cursos
      where cursos.id = curso_instructores.id_curso
        and (
          cursos.mostrado = true
          or private.es_administrador()
          or private.tiene_acceso_vigente_curso(cursos.id)
        )
    )
  );

drop policy if exists "curso_instructores_admin_insert" on public.curso_instructores;
create policy "curso_instructores_admin_insert" on public.curso_instructores
  for insert with check (private.es_administrador());

drop policy if exists "curso_instructores_admin_update" on public.curso_instructores;
create policy "curso_instructores_admin_update" on public.curso_instructores
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "curso_instructores_admin_delete" on public.curso_instructores;
create policy "curso_instructores_admin_delete" on public.curso_instructores
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- VISTA: curso_instructores_publico
--
-- El problema
-- -----------
-- Un visitante anónimo necesita ver el nombre y la especialidad de quien dicta
-- un curso publicado. Esos datos ahora viven en `perfiles`, junto a `correo`,
-- `celular`, `estado` y `rol`. RLS de Postgres es por FILA, no por columna:
-- una policy nueva del tipo "cualquiera puede ver la fila de un profesor de
-- curso publicado" abriría TODAS las columnas de esa fila a `anon`. Eso sería
-- una fuga de datos personales, no una feature de catálogo.
--
-- `perfiles_select_propio` (001/002) se queda exactamente como está —dueño de
-- la fila o administrador— y esta vista es la única puerta pública, con la
-- proyección recortada a `nombre` y `especialidad`.
--
-- Por qué esta vista NO lleva security_invoker (al revés que 033 y 036)
-- --------------------------------------------------------------------
-- `033_vista_progreso_cursos.sql` y `036_vistas_metricas_panel.sql` usan
-- `security_invoker = true` porque agregan datos que RLS ya sabe acotar por
-- usuario, y ahí saltarse RLS sería la fuga. Aquí es al revés: el objetivo
-- explícito es dar a `anon` un dato que RLS le niega, recortado a dos
-- columnas. Una vista normal se ejecuta con los permisos de su DUEÑO
-- (`postgres`, que es también el dueño de `perfiles`), así que la RLS de
-- `perfiles` y `curso_instructores` no aplica por debajo — y el control de
-- acceso lo hace el WHERE de la propia vista. Ese WHERE es la copia literal
-- del criterio de `curso_instructores_select_publico`, para que no puedan
-- divergir en silencio.
--
-- NO le agregues `security_invoker = true` para "arreglar" que Supabase
-- Advisors la marque como security definer view: eso la dejaría devolviendo
-- cero filas a todo visitante sin sesión y el catálogo entero se quedaría sin
-- instructor. Es una excepción deliberada y auditada, del mismo tipo que
-- `verificar_certificado()` (015): dar acceso público a un dato puntual sin
-- volver pública la tabla.
--
-- security_barrier = true: el trabajo entero de esta vista es control de
-- acceso a filas, así que ningún predicado de quien consulta puede evaluarse
-- antes que su WHERE. Cuesta la materialización de unas pocas decenas de filas
-- en la búsqueda del catálogo (el `ilike` de trigramas no es LEAKPROOF y por
-- tanto no se empuja hacia dentro); el filtro por `id_curso`, que es el uso
-- caliente, sigue empujándose porque `=` sobre uuid sí lo es.
--
-- Nunca expone `id_admin_creador`, `correo`, `celular`, `estado` ni `rol`.
-- Tampoco filtra por `rol = 'PROFESOR'`: quién puede figurar como instructor
-- lo valida la Server Action al escribir (src/actions/admin/cursos.ts). Si un
-- admin se quita a sí mismo el rol después, su nombre debe seguir apareciendo
-- en los cursos que ya dicta, no desaparecer del catálogo.
-- ------------------------------------------------------------

-- Los permisos de EJECUCIÓN de una función se comprueban contra quien llama,
-- no contra el dueño de la vista (a diferencia de los permisos sobre las
-- TABLAS que la vista lee). O sea que `anon` necesita EXECUTE propio sobre las
-- dos funciones del WHERE de abajo, o la consulta muere con "permission denied
-- for function" en vez de devolver cero filas.
--
--   · `private.es_administrador()` (002) nunca revocó EXECUTE de PUBLIC, y ya
--     la evalúan como `anon` las policies de `cursos`/`curso_categorias`.
--   · `private.tiene_acceso_vigente_curso(uuid)` recibió su grant a `anon` en
--     052_comentarios.sql, por exactamente el mismo motivo.
--
-- Se repite acá, idempotente, para que esta vista no dependa en silencio de un
-- grant que vive en otro archivo por una razón distinta. Para `anon`,
-- `auth.uid()` es null y ambas devuelven `false` de forma natural: el grant no
-- abre nada por sí solo.
grant execute on function private.tiene_acceso_vigente_curso(uuid) to anon, authenticated;
grant execute on function private.es_administrador() to anon, authenticated;

drop view if exists public.curso_instructores_publico;

create view public.curso_instructores_publico
with (security_barrier = true) as
select
  ci.id_curso,
  p.id as id_instructor,
  p.nombre,
  p.especialidad
from public.curso_instructores ci
join public.perfiles p on p.id = ci.id_instructor
where exists (
  select 1 from public.cursos c
  where c.id = ci.id_curso
    and (
      c.mostrado = true
      or private.es_administrador()
      or private.tiene_acceso_vigente_curso(c.id)
    )
);

grant select on public.curso_instructores_publico to anon, authenticated;

-- ------------------------------------------------------------
-- RPC: buscar_catalogo — nueva definición
--
-- Redefine la versión de 034_busqueda_catalogo.sql (mismo patrón que usa
-- 039_revocacion_cortesia.sql al redefinir `tiene_acceso_vigente_curso`).
-- Hacía `join public.instructores i on i.id = c.id_instructor`, que a partir
-- de esta migración devolvería el instructor viejo o —para cursos creados
-- desde ahora, con `id_instructor` null— ninguna fila en absoluto: el INNER
-- JOIN los habría borrado del catálogo por completo.
--
-- El tipo de retorno NO cambia (`create or replace` no podría cambiarlo, y
-- `src/lib/categoria.ts` ya consume `instructor_nombre text`). Con varios
-- instructores por curso, ese campo pasa a ser el `string_agg` de los nombres
-- ordenados alfabéticamente ("Ana Ruiz, Daniel Castaño"). Se agrega en SQL, no
-- en la app, para que la paginación siga siendo una fila por curso.
--
-- El match por instructor es un EXISTS —basta con que CUALQUIERA de los
-- instructores del curso coincida— y no un ILIKE sobre el string_agg ya
-- concatenado: buscar "Ruiz, Daniel" no debe encontrar nada solo porque esos
-- dos nombres quedaron pegados por el separador.
--
-- Sigue siendo `security invoker` (sin SECURITY DEFINER): la RLS de `cursos` y
-- `curso_categorias` sigue aplicando por debajo del filtro explícito
-- `mostrado = true`, igual que antes. La parte del instructor va por
-- `curso_instructores_publico`, que trae su propio filtro equivalente (ver
-- arriba), así que la doble capa se conserva.
--
-- Índices: `perfiles_nombre_trgm_idx` YA existe con exactamente la misma
-- expresión (`normalizar_busqueda(nombre)`), creado en
-- 037_admin_listar_usuarios.sql — no se crea ninguno nuevo aquí. Tampoco se
-- borra `instructores_nombre_trgm_idx` (034): eso va en la migración de
-- limpieza, junto con el DROP de la tabla.
-- ------------------------------------------------------------

create or replace function public.buscar_catalogo(
  p_query text default null,
  p_categoria_id uuid default null,
  p_limite int default 12,
  p_offset int default 0
)
returns table (
  curso_id uuid,
  titulo text,
  nivel text,
  imagen_portada text,
  instructor_nombre text,
  categoria_nombre text,
  total_clases bigint,
  total_resultados bigint
)
language sql
stable
set search_path = public, extensions
as $$
  with base as (
    select
      c.id,
      c.titulo,
      c.nivel::text,
      c.imagen_portada,
      c.orden_visualizacion,
      -- LEFT JOIN LATERAL, no INNER: un curso publicado al que todavía no se
      -- le asignó profesor tiene que seguir saliendo en el catálogo (la app
      -- muestra "Sin instructor"), no desaparecer de él.
      ins.instructor_nombre,
      (
        select cat.nombre
        from public.curso_categorias cc2
        join public.categorias cat on cat.id = cc2.id_categoria
        where cc2.id_curso = c.id
        order by cat.nombre
        limit 1
      ) as categoria_nombre,
      (
        select count(*)
        from public.modulos m2
        join public.lecciones l2 on l2.id_modulo = m2.id
        where m2.id_curso = c.id
      ) as total_clases
    from public.cursos c
    left join lateral (
      select string_agg(cip.nombre, ', ' order by cip.nombre) as instructor_nombre
      from public.curso_instructores_publico cip
      where cip.id_curso = c.id
    ) ins on true
    where c.mostrado = true
      and (
        p_categoria_id is null
        or exists (
          select 1 from public.curso_categorias cc
          where cc.id_curso = c.id and cc.id_categoria = p_categoria_id
        )
      )
      and (
        p_query is null or trim(p_query) = ''
        or public.normalizar_busqueda(c.titulo) ilike '%' || public.normalizar_busqueda(p_query) || '%'
        or exists (
          select 1
          from public.curso_instructores_publico cip2
          where cip2.id_curso = c.id
            and public.normalizar_busqueda(cip2.nombre) ilike '%' || public.normalizar_busqueda(p_query) || '%'
        )
      )
  )
  select
    base.id,
    base.titulo,
    base.nivel,
    base.imagen_portada,
    base.instructor_nombre,
    base.categoria_nombre,
    base.total_clases,
    count(*) over() as total_resultados
  from base
  -- orden_visualizacion por sí solo no alcanza: la mayoría de los cursos
  -- comparte el valor por defecto (0), y sin un desempate estable Postgres
  -- no garantiza el mismo orden entre dos llamadas con distinto offset —
  -- la paginación podría repetir o saltarse cursos entre páginas.
  order by base.orden_visualizacion, base.id
  limit p_limite offset p_offset;
$$;

grant execute on function public.buscar_catalogo(text, uuid, int, int) to anon, authenticated;
