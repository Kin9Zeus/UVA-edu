-- ============================================================
-- 092 — Comentarios de lección: suma foto_url a comentarios_autor_publico
-- ============================================================
-- Mismo motivo que 091 sumó foto_url a comunidad_autor_publico: sin esto,
-- el comentario de cualquier autor que no sea uno mismo muestra el ícono
-- genérico de siempre (RLS de `perfiles` solo deja leer la fila propia).
-- `CREATE OR REPLACE VIEW` alcanza: se agrega una columna al final, nada
-- más cambia — ni las que ya existían ni el WHERE.
create or replace view public.comentarios_autor_publico
with (security_barrier = true) as
select distinct
  p.id,
  p.nombre,
  (p.rol = 'PROFESOR') as es_profesor,
  p.pais,
  p.foto_url
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
