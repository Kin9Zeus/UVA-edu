-- ------------------------------------------------------------
-- VISTA: progreso_cursos_estudiante
--
-- Revf3 ("Porcentaje de avance por curso y sección Mis cursos / Continuar
-- viendo"): el cálculo del % de avance vivía en código de aplicación
-- (lib/progreso.ts, lib/dashboard.ts), que traía cada fila de `progreso`
-- del estudiante y las sumaba con `.reduce()` en JS. Esta vista mueve el
-- conteo a un `count(...) filter (...)` agregado en Postgres — una fila
-- por curso, no una por lección ni por fila de progreso.
--
-- "Lecciones publicadas": estado_procesamiento = 'LISTO'. Una lección
-- SUBIENDO/PROCESANDO/ERROR no tiene video que el estudiante pueda ver
-- (lib/leccion.ts ya usa el mismo criterio para `videoListo`), así que no
-- cuenta ni para el total ni para el numerador de completadas — de lo
-- contrario un curso con una lección a medio subir nunca llegaría al 100%
-- aunque el estudiante haya visto todo lo que sí está disponible.
--
-- "Curso tocado": tiene al menos una fila en `progreso` (no depende de
-- `inscripciones`, que desde 032_revoca_autoinscripcion_membresia.sql solo
-- se llena para accesos CORTESIA — un estudiante con Suscripción activa
-- nunca tiene fila ahí, así que basarse en esa tabla dejaría fuera a la
-- mayoría de los cursos en progreso real).
--
-- security_invoker = true: la vista corre con los permisos y las RLS
-- policies de quien consulta, no de quien la creó. Pensada para que la
-- consulte el propio estudiante (progreso_select_propio la acota a sus
-- filas). Pero progreso_select_administrador (028) deja a un administrador
-- ver TODAS las filas de `progreso`, de cualquier estudiante — un JOIN
-- directo a `progreso` fan-out-ea ahí: una lección con 5 estudiantes con
-- fila propia aparecería 5 veces en el `count(l.id)`, inflando
-- lecciones_total. Por eso el join es LATERAL con su propio agregado
-- (`bool_or`/`max`) que colapsa a una sola fila por lección ANTES de
-- entrar al group by de afuera — así lecciones_total siempre es exactamente
-- el número de lecciones LISTAS, sin importar cuántas filas de `progreso`
-- pueda ver quien consulta.
-- ------------------------------------------------------------

drop view if exists public.progreso_cursos_estudiante;

create view public.progreso_cursos_estudiante
with (security_invoker = true) as
with cursos_tocados as (
  select distinct m.id_curso
  from public.progreso pr
  join public.lecciones l on l.id = pr.id_leccion
  join public.modulos m on m.id = l.id_modulo
)
select
  c.id as curso_id,
  c.titulo,
  c.imagen_portada,
  c.nivel,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO') as lecciones_total,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO' and pr.completado) as lecciones_completadas,
  max(pr.actualizado_en) as ultima_actividad
from cursos_tocados ct
join public.cursos c on c.id = ct.id_curso
join public.modulos m on m.id_curso = c.id
join public.lecciones l on l.id_modulo = m.id
left join lateral (
  select bool_or(pr.completado) as completado, max(pr.actualizado_en) as actualizado_en
  from public.progreso pr
  where pr.id_leccion = l.id
) pr on true
group by c.id, c.titulo, c.imagen_portada, c.nivel;

grant select on public.progreso_cursos_estudiante to authenticated;
