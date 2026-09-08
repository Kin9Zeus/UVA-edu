-- ============================================================
-- La lección introductoria pasa de función a columna
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-3 (P1), primera mitad.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-075.
-- requiere-migracion: 20260908010000_leccion_introductoria_materializada
-- REQUIERE la migración de Prisma 20260908010000_leccion_introductoria_materializada
-- (columna lecciones.es_introductoria).
--
-- La medición
-- -----------
-- Leer 20 comentarios en una base con 29 comentarios, 30 lecciones, 14
-- módulos y 8 cursos costaba 1 613 buffers y 11,8 ms — 55 páginas por
-- comentario. Aislando el predicado culpable:
--
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT count(*) FROM comentarios c
--    WHERE private.es_leccion_introductoria(c.id_leccion);
--
--   Seq Scan on comentarios c (actual time=2.236..3.496 rows=21 loops=1)
--     Filter: private.es_leccion_introductoria(id_leccion)
--     Buffers: shared hit=605          <- 21 buffers POR COMENTARIO
--
-- Por qué no se puede arreglar con (select ...)
-- ---------------------------------------------
-- El truco de 056 —envolver en subconsulta escalar para que Postgres lo
-- promueva a InitPlan— no sirve aquí: la función recibe `id_leccion`, una
-- columna de la fila. Es una llamada correlacionada, y una correlacionada no
-- se iza. Da igual cuántos paréntesis se le pongan: se evalúa una vez por
-- fila, y cada evaluación une `lecciones` con `modulos` de todo el curso,
-- ordena por (modulo.orden, leccion.orden) y toma el primero.
--
-- El coste crece con lecciones_por_curso x comentarios_mostrados, en la
-- pantalla del reproductor, que es la más visitada de la aplicación. Con un
-- curso de 60 lecciones y 5 000 comentarios son 5 000 escaneos ordenados del
-- temario para pintar una lista.
--
-- La solución
-- -----------
-- Es un dato que cambia cuando se reordena el temario, no cuando alguien lee
-- un comentario. Materializarlo convierte una llamada a función por fila en
-- una referencia a columna, indexable y gratis.
--
-- La función `private.es_leccion_introductoria()` NO se borra: sigue siendo
-- la definición ejecutable de la regla y es lo que usa el recálculo de abajo.
-- Lo que desaparece es su uso dentro de las policies.
-- ============================================================

-- ------------------------------------------------------------
-- El recálculo, por curso entero.
--
-- Se recalcula el curso completo en vez de intentar deducir qué fila
-- concreta cambió de estado: mover la primera lección al final cambia DOS
-- filas (la que deja de serlo y la que pasa a serlo), y borrar la penúltima
-- lección de un curso de dos cambia una tercera cosa (deja de haber
-- introductoria, porque la regla exige count > 1). Recalcular el curso es
-- una sola sentencia y no hay que razonar cada caso.
--
-- El `is distinct from` evita escrituras que no cambian nada: sin él, cada
-- reordenamiento reescribiría todas las lecciones del curso y dispararía
-- `set_actualizado_en` en todas.
-- ------------------------------------------------------------
create or replace function private.recalcular_leccion_introductoria(p_id_curso uuid)
returns void
language sql
security definer set search_path = public
as $$
  with del_curso as (
    select l.id, m.orden as modulo_orden, l.orden as leccion_orden
    from public.lecciones l
    join public.modulos m on m.id = l.id_modulo
    where m.id_curso = p_id_curso
  ),
  intro as (
    select id from del_curso
    -- Misma regla que private.es_leccion_introductoria: un curso de una sola
    -- lección no regala esa lección.
    where (select count(*) from del_curso) > 1
    order by modulo_orden, leccion_orden
    limit 1
  )
  update public.lecciones l
     set es_introductoria = (l.id in (select id from intro))
   where l.id in (select id from del_curso)
     and l.es_introductoria is distinct from (l.id in (select id from intro));
$$;

-- ------------------------------------------------------------
-- Triggers de mantenimiento.
--
-- Son AFTER y devuelven null: no modifican la fila que los disparó, solo
-- lanzan el recálculo del curso.
--
-- La recursión se corta por la lista de columnas: el trigger de `lecciones`
-- escucha UPDATE OF orden, id_modulo — no `es_introductoria`. El UPDATE que
-- hace el propio recálculo, por tanto, no vuelve a dispararlo.
-- ------------------------------------------------------------
create or replace function private.lecciones_recalcula_introductoria()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_curso uuid;
begin
  if tg_op <> 'DELETE' then
    select m.id_curso into v_curso from public.modulos m where m.id = new.id_modulo;
    if v_curso is not null then
      perform private.recalcular_leccion_introductoria(v_curso);
    end if;
  end if;

  -- El curso ANTERIOR, que puede ser otro si la lección cambió de módulo.
  -- El `is not null` no es defensivo por costumbre: cuando se borra un
  -- módulo, sus lecciones caen en cascada y este trigger corre con el módulo
  -- ya inexistente. Sin la guardia, el recálculo se llamaría con null.
  if tg_op <> 'INSERT' then
    select m.id_curso into v_curso from public.modulos m where m.id = old.id_modulo;
    if v_curso is not null then
      perform private.recalcular_leccion_introductoria(v_curso);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists lecciones_recalcula_introductoria on public.lecciones;
create trigger lecciones_recalcula_introductoria
  after insert or delete or update of orden, id_modulo on public.lecciones
  for each row execute function private.lecciones_recalcula_introductoria();

create or replace function private.modulos_recalcula_introductoria()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op <> 'DELETE' then
    perform private.recalcular_leccion_introductoria(new.id_curso);
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.id_curso is distinct from old.id_curso) then
    perform private.recalcular_leccion_introductoria(old.id_curso);
  end if;

  return null;
end;
$$;

drop trigger if exists modulos_recalcula_introductoria on public.modulos;
create trigger modulos_recalcula_introductoria
  after insert or delete or update of orden, id_curso on public.modulos
  for each row execute function private.modulos_recalcula_introductoria();

-- ------------------------------------------------------------
-- Relleno inicial. Idempotente por el `is distinct from` del recálculo: en
-- una base ya al día no escribe nada.
-- ------------------------------------------------------------
select private.recalcular_leccion_introductoria(cursos.id) from public.cursos;

-- ------------------------------------------------------------
-- Las policies dejan de llamar a la función.
--
-- Solo cambia el término `private.es_leccion_introductoria(id_leccion)` por
-- la columna; el resto de cada policy queda idéntico a 070 (progreso) y 056
-- (comentarios).
-- ------------------------------------------------------------
drop policy if exists "progreso_insert_propio" on public.progreso;
create policy "progreso_insert_propio" on public.progreso
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (
      (select private.tiene_acceso_vigente_curso(
        (select m.id_curso
           from public.lecciones l
           join public.modulos m on m.id = l.id_modulo
          where l.id = id_leccion)))
      or exists (
        select 1 from public.lecciones l
        where l.id = id_leccion and l.es_introductoria
      )
    )
  );

drop policy if exists "progreso_update_propio" on public.progreso;
create policy "progreso_update_propio" on public.progreso
  for update using ((select auth.uid()) = id_usuario)
  with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (
      (select private.tiene_acceso_vigente_curso(
        (select m.id_curso
           from public.lecciones l
           join public.modulos m on m.id = l.id_modulo
          where l.id = id_leccion)))
      or exists (
        select 1 from public.lecciones l
        where l.id = id_leccion and l.es_introductoria
      )
    )
  );

-- Comentarios: es la policy donde se midió el problema. El EXISTS sobre
-- `lecciones` por la PK con un filtro sobre una columna es una búsqueda de
-- índice; la función era un escaneo ordenado del temario.
drop policy if exists "comentarios_select_con_acceso" on public.comentarios;
create policy "comentarios_select_con_acceso" on public.comentarios
  for select using (
    (select private.es_administrador())
    or exists (
      select 1 from public.lecciones l
      where l.id = comentarios.id_leccion and l.es_introductoria
    )
    or exists (
      select 1
      from public.lecciones l
      join public.modulos m on m.id = l.id_modulo
      where l.id = comentarios.id_leccion
        and private.tiene_acceso_vigente_curso(m.id_curso)
    )
  );

drop policy if exists "comentarios_insert_propio" on public.comentarios;
create policy "comentarios_insert_propio" on public.comentarios
  for insert with check (
    (select auth.uid()) = id_usuario
    and (
      exists (
        select 1 from public.lecciones l
        where l.id = comentarios.id_leccion and l.es_introductoria
      )
      or exists (
        select 1
        from public.lecciones l
        join public.modulos m on m.id = l.id_modulo
        where l.id = comentarios.id_leccion
          and private.tiene_acceso_vigente_curso(m.id_curso)
      )
    )
  );

-- La vista de autores públicos, con el mismo cambio. El resto es idéntico a
-- 074.
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
      or l.es_introductoria
      or private.tiene_acceso_vigente_curso(m.id_curso)
    )
);

grant select on public.comentarios_autor_publico to anon, authenticated;
