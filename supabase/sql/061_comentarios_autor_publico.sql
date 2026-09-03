-- ============================================================
-- VISTA: comentarios_autor_publico
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-060.
--
-- El problema
-- -----------
-- src/lib/comentarios.ts arma el árbol de comentarios de una lección con
-- `usuario:perfiles!comentarios_id_usuario_fkey(nombre, rol)`. Ese embed
-- corre bajo la RLS de `perfiles`, que es "perfiles_select_propio"
-- (002/056): dueño de la fila o administrador. Para CUALQUIER comentario
-- que no sea el propio, PostgREST no puede leer esa fila de `perfiles` y
-- el embed vuelve null — TypeScript lo tapa con el fallback `?? "Usuario"`
-- / iniciales "?", así que en producción el nombre de cualquier otro
-- alumno o profesor que comenta nunca se veía; solo el propio. No es un
-- bug nuevo de esta migración, ya existía; se detectó ahora porque
-- Perfil.md agrega `pais` al mismo embed para mostrar la bandera junto al
-- nombre (src/lib/paises.ts, banderaDePais), y ese dato tampoco iba a
-- llegar nunca por el mismo motivo.
--
-- Por qué una vista y no una policy nueva en perfiles
-- ----------------------------------------------------
-- Mismo razonamiento que curso_instructores_publico (053): RLS es por
-- FILA. Una policy "cualquiera que vea el comentario puede ver la fila
-- del autor" abriría TODA la fila —correo, celular incluidos— a
-- cualquier compañero de curso, no solo nombre/rol/país. Esta vista
-- proyecta nada más esas tres columnas, sin `security_invoker` (corre
-- como su dueño, `postgres`, así que la RLS de `perfiles` no aplica por
-- debajo) — el control de acceso lo hace su propio WHERE, calcado del de
-- `comentarios_select_con_acceso` (052) para que no puedan divergir en
-- silencio: un perfil aparece acá si y solo si autoró al menos un
-- comentario que la sesión actual ya podría leer.
--
-- security_barrier = true por la misma razón que 053: el trabajo entero
-- de esta vista es control de acceso a filas.
-- ============================================================

grant execute on function private.tiene_acceso_vigente_curso(uuid) to anon, authenticated;
grant execute on function private.es_leccion_introductoria(uuid) to anon, authenticated;
grant execute on function private.es_administrador() to anon, authenticated;

drop view if exists public.comentarios_autor_publico;

create view public.comentarios_autor_publico
with (security_barrier = true) as
select distinct
  p.id,
  p.nombre,
  p.rol,
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
