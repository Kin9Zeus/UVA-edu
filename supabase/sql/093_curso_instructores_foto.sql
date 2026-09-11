-- ============================================================
-- 093 — Ficha de instructor: suma foto_url a curso_instructores_publico
-- ============================================================
-- Mismo motivo que 091/092: sin esto, la tarjeta "quién dicta el curso"
-- (público, sin login) solo puede mostrar las iniciales del profesor —
-- RLS de `perfiles` no deja leer su fila directo. `CREATE OR REPLACE VIEW`
-- alcanza: se agrega una columna al final, el resto queda idéntico a 053.
create or replace view public.curso_instructores_publico
with (security_barrier = true) as
select
  ci.id_curso,
  p.id as id_instructor,
  p.nombre,
  p.especialidad,
  p.foto_url
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
