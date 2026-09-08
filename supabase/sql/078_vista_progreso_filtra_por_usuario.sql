-- ============================================================
-- progreso_cursos_estudiante filtra por usuario de forma explícita
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-10 (P2).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-077.
--
-- Qué estaba mal
-- --------------
-- La vista es `security_invoker = true`, que es lo correcto — pero su lateral
-- no filtraba por usuario:
--
--   LEFT JOIN LATERAL (
--     SELECT bool_or(pr_1.completado), max(pr_1.actualizado_en)
--     FROM progreso pr_1
--     WHERE pr_1.id_leccion = l.id          <- sin AND id_usuario = auth.uid()
--   ) pr ON true
--
-- Para un estudiante el resultado es correcto POR ACCIDENTE: la policy
-- `progreso_select_propio` recorta las filas antes de que el agregado las
-- vea. Pero esa misma policy dice `OR private.es_administrador()`, así que
-- para un administrador la vista devuelve `bool_or` sobre el progreso de
-- TODOS los usuarios: "lecciones_completadas" pasa a significar "lecciones
-- que completó alguien". Lo mismo con `cursos_tocados`, que lista los cursos
-- en los que cualquiera dejó progreso.
--
-- Por qué importa aunque hoy nadie la lea como admin
-- --------------------------------------------------
-- Una vista cuya corrección depende íntegramente de que RLS la recorte es
-- frágil de una forma silenciosa: no falla, MIENTE. Y sobrevive solo hasta
-- que alguien la consulte con service_role (que salta RLS por completo) o
-- amplíe la policy de `progreso`. Hoy la consumen src/lib/dashboard.ts,
-- src/lib/progreso.ts y src/lib/categoria.ts, siempre con la sesión del
-- estudiante — así que este cambio no altera ningún resultado actual. Lo
-- que hace es que deje de depender de la suerte.
--
-- El filtro explícito tampoco es redundante con RLS: son dos capas que dicen
-- lo mismo, y el nombre de la vista ya prometía la de arriba.
--
-- El resto queda idéntico a 033/062.
-- ============================================================

drop view if exists public.progreso_cursos_estudiante;
create view public.progreso_cursos_estudiante
with (security_invoker = true) as
with cursos_tocados as (
  select distinct m.id_curso
  from public.progreso pr
  join public.lecciones l on l.id = pr.id_leccion
  join public.modulos m on m.id = l.id_modulo
  where pr.id_usuario = (select auth.uid())
)
select
  c.id as curso_id,
  c.slug as curso_slug,
  c.titulo,
  c.imagen_portada,
  c.nivel,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO') as lecciones_total,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO' and pr.completado) as lecciones_completadas,
  max(pr.actualizado_en) as ultima_actividad,
  private.curso_exige_examen(c.id) as examen_requerido,
  private.aprobo_examen_curso((select auth.uid()), c.id) as examen_aprobado
from cursos_tocados ct
join public.cursos c on c.id = ct.id_curso
join public.modulos m on m.id_curso = c.id
join public.lecciones l on l.id_modulo = m.id
left join lateral (
  select bool_or(pr_1.completado) as completado,
         max(pr_1.actualizado_en) as actualizado_en
  from public.progreso pr_1
  where pr_1.id_leccion = l.id
    and pr_1.id_usuario = (select auth.uid())
) pr on true
group by c.id, c.slug, c.titulo, c.imagen_portada, c.nivel;

grant select on public.progreso_cursos_estudiante to anon, authenticated;
