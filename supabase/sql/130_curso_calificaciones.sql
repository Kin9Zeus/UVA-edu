-- ============================================================
-- Row Level Security: curso_calificaciones + curso_calificacion_reacciones
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-111, y
-- después de la migración de Prisma que crea ambas tablas
-- (prisma/migrations/20260915000000_curso_calificaciones).
--
-- Qué es esto
-- -----------
-- Calificación con estrellas (1-5) + comentario opcional de un estudiante
-- sobre un curso, con "me gusta" a cada reseña — pedido explícito del
-- usuario. A diferencia de Comunidad (comunidad_tiene_acceso(), cerrada),
-- el catálogo de cursos es público sin sesión (CursoDetalleContent con
-- basePath="/catalogo"), así que las reseñas son visibles a `anon` también:
-- es contenido de marketing del curso, no de una comunidad cerrada.
--
-- Quién puede calificar: mismo umbral que comentar una lección
-- (private.tiene_acceso_vigente_curso, 038/052) — haber tenido/tener acceso
-- real al curso, no solo estar autenticado. Una fila por (curso, usuario):
-- el índice único parcial de abajo (`where not eliminado`) permite volver a
-- calificar tras borrar la reseña propia, sin acumular filas fantasma.
-- ============================================================

-- ------------------------------------------------------------
-- Unicidad: una reseña activa por usuario y curso. Parcial (no un
-- @@unique de Prisma) para que borrar la propia y volver a calificar no
-- choque contra la fila ya eliminada — mismo criterio que los índices
-- parciales de comunidad_reacciones (083).
-- ------------------------------------------------------------
create unique index if not exists curso_calificaciones_unica_por_usuario
  on public.curso_calificaciones (id_curso, id_usuario)
  where not eliminado;

do $$
begin
  alter table public.curso_calificaciones
    add constraint curso_calificaciones_puntuacion_valida
    check (puntuacion between 1 and 5);
exception
  when duplicate_object then null; -- ya existe, script re-corrido sin problema
end;
$$;

-- `actualizado_en` se escribe con supabase-js (PostgREST), nunca con Prisma
-- Client — el `@updatedAt` de schema.prisma no traduce a DDL. Mismo patrón
-- que 024/comunidad_posts: DEFAULT + trigger con la función ya existente.
alter table public.curso_calificaciones alter column actualizado_en set default now();

drop trigger if exists set_actualizado_en on public.curso_calificaciones;
create trigger set_actualizado_en
  before update on public.curso_calificaciones
  for each row execute function private.actualiza_actualizado_en();

-- ============================================================
-- RLS: curso_calificaciones
--
-- · SELECT: pública (anon incluido) para reseñas no eliminadas de un curso
--   visible (mismo gate que curso_instructores_publico, 053: mostrado, o
--   admin, o acceso vigente — un curso despublicado con progreso no debe
--   perder sus reseñas para quien ya lo tomó). Un admin además ve las
--   eliminadas, para poder auditar/moderar.
-- · INSERT: el propio usuario, con acceso vigente al curso, cuenta activa
--   y correo verificado (patrón fijo de 019 en toda escritura).
-- · UPDATE: el propio autor (editar su reseña) o un admin (moderar,
--   ocultándola) — qué transición exacta es válida para cada uno se
--   resuelve con privilegio por columna + trigger, no en la policy (mismo
--   criterio que comunidad_posts, 083).
-- · DELETE real: nadie, borrado lógico únicamente.
-- ============================================================
alter table public.curso_calificaciones enable row level security;

-- El propio autor entra siempre ((select auth.uid()) = id_usuario), incluso
-- con `eliminado = true` — no por que la app vaya a listarle su reseña
-- borrada (getCalificacionesCurso ya filtra `eliminado = false` aparte),
-- sino porque Postgres combina esta policy de SELECT con el WITH CHECK de
-- UPDATE (para garantizar que la fila resultante siga siendo visible para
-- quien la modifica): sin esta rama, el propio autor NUNCA podría poner
-- `eliminado = true` en su fila, porque el estado resultante dejaría de
-- cumplir `not eliminado` y Postgres rechazaría la transición con "new row
-- violates row-level security policy" — se reprodujo y confirmó con
-- EXPLAIN contra la base real. Mismo motivo por el que comunidad_posts
-- directamente no filtra por `eliminado` en su SELECT (083_comunidad.sql).
drop policy if exists "curso_calificaciones_select_publico" on public.curso_calificaciones;
create policy "curso_calificaciones_select_publico" on public.curso_calificaciones
  for select using (
    (not eliminado or private.es_administrador() or (select auth.uid()) = id_usuario)
    and exists (
      select 1 from public.cursos
      where cursos.id = curso_calificaciones.id_curso
        and (
          cursos.mostrado = true
          or private.es_administrador()
          or private.tiene_acceso_vigente_curso(cursos.id)
        )
    )
  );

drop policy if exists "curso_calificaciones_insert_propio" on public.curso_calificaciones;
create policy "curso_calificaciones_insert_propio" on public.curso_calificaciones
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and private.tiene_acceso_vigente_curso(id_curso)
    and eliminado = false
    and eliminado_por_admin = false
    and id_eliminado_por is null
  );

drop policy if exists "curso_calificaciones_update_propio_o_admin" on public.curso_calificaciones;
create policy "curso_calificaciones_update_propio_o_admin" on public.curso_calificaciones
  for update using ((select auth.uid()) = id_usuario or private.es_administrador())
  with check ((select auth.uid()) = id_usuario or private.es_administrador());

-- Capa 1 — privilegio por columna: el propio autor solo necesita reescribir
-- puntuacion/comentario (editar) o eliminado (borrar la suya); un admin
-- además necesita eliminado_por_admin/id_eliminado_por (moderar).
revoke update on public.curso_calificaciones from anon;
revoke update on public.curso_calificaciones from authenticated;
grant update (puntuacion, comentario, eliminado, eliminado_por_admin, id_eliminado_por)
  on public.curso_calificaciones to authenticated;

-- Capa 2 — transiciones concretas (mismo razonamiento que
-- comunidad_posts_transiciones_permitidas, 083/087):
--   · puntuacion/comentario: solo el propio autor, y nunca si la reseña ya
--     está eliminada (ni la está eliminando en esta misma transacción).
--   · eliminado de false a true: el propio autor (borra la suya) o un
--     admin (modera). De true a false (restaurar): solo un admin.
--   · eliminado_por_admin/id_eliminado_por: solo los puede fijar un admin,
--     y únicamente junto con eliminado = true (no se "pre-marca" una
--     reseña como moderada sin ocultarla).
create or replace function private.curso_calificaciones_transiciones_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.puntuacion is distinct from old.puntuacion
    or new.comentario is distinct from old.comentario
  ) and (old.eliminado or new.eliminado or (select auth.uid()) <> old.id_usuario) then
    raise exception 'Una reseña solo la puede editar su propio autor, mientras no esté eliminada.'
      using errcode = 'check_violation';
  end if;

  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Una reseña eliminada solo puede restaurarla un administrador.'
      using errcode = 'check_violation';
  end if;

  if (
    new.eliminado_por_admin is distinct from old.eliminado_por_admin
    or new.id_eliminado_por is distinct from old.id_eliminado_por
  ) then
    if not private.es_administrador() then
      raise exception 'Marcar una reseña como moderada requiere un administrador.'
        using errcode = 'check_violation';
    end if;
    if new.eliminado_por_admin and not new.eliminado then
      raise exception 'Una reseña moderada por un admin debe quedar eliminada.'
        using errcode = 'check_violation';
    end if;
    if new.id_eliminado_por is distinct from (select auth.uid()) and new.id_eliminado_por is not null then
      raise exception 'Un administrador solo puede firmar la moderación con su propio id.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists curso_calificaciones_transiciones_permitidas on public.curso_calificaciones;
create trigger curso_calificaciones_transiciones_permitidas
  before update on public.curso_calificaciones
  for each row execute function private.curso_calificaciones_transiciones_permitidas();

-- ============================================================
-- RLS: curso_calificacion_reacciones ("me gusta" a una reseña)
--
-- Mismo criterio que comunidad_reacciones (083) para el dueño de la fila,
-- pero el objetivo visible es el mismo que curso_calificaciones_select_publico
-- (no solo "no eliminada"): sin este segundo filtro, alguien podría
-- reaccionar por id a la reseña de un curso que ni siquiera puede ver
-- (curso no publicado y sin acceso), aunque nunca se la hubieran mostrado.
-- ============================================================
alter table public.curso_calificacion_reacciones enable row level security;

drop policy if exists "curso_calificacion_reacciones_select_publico" on public.curso_calificacion_reacciones;
create policy "curso_calificacion_reacciones_select_publico" on public.curso_calificacion_reacciones
  for select using (
    exists (
      select 1 from public.curso_calificaciones cc
      join public.cursos c on c.id = cc.id_curso
      where cc.id = curso_calificacion_reacciones.id_calificacion
        and not cc.eliminado
        and (c.mostrado = true or private.es_administrador() or private.tiene_acceso_vigente_curso(c.id))
    )
  );

drop policy if exists "curso_calificacion_reacciones_insert_propio" on public.curso_calificacion_reacciones;
create policy "curso_calificacion_reacciones_insert_propio" on public.curso_calificacion_reacciones
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and exists (
      select 1 from public.curso_calificaciones cc
      join public.cursos c on c.id = cc.id_curso
      where cc.id = curso_calificacion_reacciones.id_calificacion
        and not cc.eliminado
        and (c.mostrado = true or private.es_administrador() or private.tiene_acceso_vigente_curso(c.id))
    )
  );

drop policy if exists "curso_calificacion_reacciones_delete_propio" on public.curso_calificacion_reacciones;
create policy "curso_calificacion_reacciones_delete_propio" on public.curso_calificacion_reacciones
  for delete using ((select auth.uid()) = id_usuario);

revoke update on public.curso_calificacion_reacciones from anon;
revoke update on public.curso_calificacion_reacciones from authenticated;

-- ============================================================
-- VISTA: curso_calificacion_autor_publico
--
-- Mismo problema que comunidad_autor_publico (085) / curso_instructores_publico
-- (053): `perfiles_select_propio` (001/002) solo deja leer la fila propia o
-- siendo admin, así que embeber `perfiles` directo para el nombre del autor
-- de una reseña ajena vuelve null. A diferencia de comunidad_autor_publico,
-- ésta se abre a `anon` también (mismo motivo que curso_instructores_publico:
-- las reseñas son públicas), proyectando `id`, `nombre` y `foto_url`
-- (mismo criterio que comunidad_autor_publico desde 091_perfiles_foto.sql)
-- — nunca correo, celular ni estado.
-- ============================================================
grant execute on function private.tiene_acceso_vigente_curso(uuid) to anon, authenticated;
grant execute on function private.es_administrador() to anon, authenticated;

drop view if exists public.curso_calificacion_autor_publico;

create view public.curso_calificacion_autor_publico
with (security_barrier = true) as
select distinct p.id, p.nombre, p.foto_url
from public.perfiles p
where exists (
  select 1 from public.curso_calificaciones cc
  join public.cursos c on c.id = cc.id_curso
  where cc.id_usuario = p.id
    and not cc.eliminado
    and (
      c.mostrado = true
      or private.es_administrador()
      or private.tiene_acceso_vigente_curso(c.id)
    )
);

grant select on public.curso_calificacion_autor_publico to anon, authenticated;

-- ============================================================
-- VISTA: curso_calificaciones_resumen — promedio + total por curso
--
-- Calculado al vuelo (no denormalizado en `cursos`), mismo trade-off ya
-- documentado en getComunidadFeed: evita otro trigger de sincronización
-- mientras el volumen de reseñas sea bajo. Sin gate propio en el WHERE:
-- un curso no publicado simplemente no tiene filas visibles en
-- curso_calificaciones para nadie sin acceso (RLS de la tabla base ya lo
-- filtra), así que el promedio de un curso oculto da NULL/0 para quien no
-- debería verlo de todas formas — pero por defensa en profundidad se repite
-- el mismo filtro explícito.
-- ============================================================
drop view if exists public.curso_calificaciones_resumen;

create view public.curso_calificaciones_resumen
with (security_barrier = true) as
select
  cc.id_curso,
  round(avg(cc.puntuacion)::numeric, 2) as promedio,
  count(*) as total
from public.curso_calificaciones cc
join public.cursos c on c.id = cc.id_curso
where not cc.eliminado
  and (
    c.mostrado = true
    or private.es_administrador()
    or private.tiene_acceso_vigente_curso(c.id)
  )
group by cc.id_curso;

grant select on public.curso_calificaciones_resumen to anon, authenticated;
