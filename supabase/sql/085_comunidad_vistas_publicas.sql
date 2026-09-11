-- ============================================================
-- VISTAS: comunidad_autor_publico, comunidad_actividad_reciente
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-084.
--
-- El problema
-- -----------
-- Mismo problema que resolvió comentarios_autor_publico (061): la RLS de
-- `perfiles` ("perfiles_select_propio") solo deja leer la fila propia o
-- siendo administrador, así que un embed directo a `perfiles` para mostrar
-- el nombre del autor de una publicación ajena vuelve null. Y `certificados`
-- tiene el mismo problema para "completó {curso} hace X días" — nadie puede
-- leer el certificado de otro usuario.
--
-- Por qué dos vistas y no una policy nueva
-- -----------------------------------------
-- Mismo razonamiento que 061 y que curso_instructores_publico (053): RLS es
-- por FILA. Una policy "cualquiera con acceso a Comunidad puede ver la fila
-- de perfiles/certificados del autor" abriría la fila completa (correo,
-- celular, nombre_estudiante congelado) a cualquier compañero, no solo lo
-- que la UI necesita. Cada vista proyecta nada más las columnas que hacen
-- falta, con un WHERE que repite la misma condición de acceso que las
-- tablas de Comunidad (public.comunidad_tiene_acceso()), para que no puedan
-- divergir en silencio.
--
-- `comunidad_actividad_reciente` solo expone `nombre_curso`/`fecha_emision`
-- (el snapshot congelado de Certificados), nunca `nombre_estudiante`: el
-- nombre para mostrar sale de `comunidad_autor_publico`, para no tener dos
-- copias del nombre que puedan desincronizarse si alguien corrige el suyo.
--
-- security_barrier = true por el mismo motivo que 053/061: el trabajo
-- entero de estas vistas es control de acceso a filas, sin security_invoker
-- (corren como su dueño, así que la RLS de las tablas base no aplica por
-- debajo — el WHERE de la vista es el único control).
-- ============================================================

drop view if exists public.comunidad_autor_publico;

create view public.comunidad_autor_publico
with (security_barrier = true) as
select distinct p.id, p.nombre
from public.perfiles p
where public.comunidad_tiene_acceso()
  and (
    exists (select 1 from public.comunidad_posts where id_usuario = p.id)
    or exists (select 1 from public.comunidad_respuestas where id_usuario = p.id)
  );

grant select on public.comunidad_autor_publico to authenticated;

drop view if exists public.comunidad_actividad_reciente;

create view public.comunidad_actividad_reciente
with (security_barrier = true) as
select distinct on (c.id_usuario)
  c.id_usuario,
  c.nombre_curso,
  c.fecha_emision
from public.certificados c
where public.comunidad_tiene_acceso()
  and (
    exists (select 1 from public.comunidad_posts where id_usuario = c.id_usuario)
    or exists (select 1 from public.comunidad_respuestas where id_usuario = c.id_usuario)
  )
order by c.id_usuario, c.fecha_emision desc;

grant select on public.comunidad_actividad_reciente to authenticated;
