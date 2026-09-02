-- ============================================================
-- Row Level Security (RLS): Comentarios y ComentarioLikes
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-051, y
-- después de correr la migración de Prisma que crea `comentarios` y
-- `comentario_likes` (prisma/migrations/*_rol_profesor).
--
-- Criterio
-- --------
--   · SELECT: cualquiera que pueda ver la lección (misma regla que
--     "lecciones_select_curso_publico", 001/002/030: curso publicado o
--     candidato a alguna excepción) Y tenga acceso vigente al curso
--     (private.tiene_acceso_vigente_curso, 039) — salvo que sea la lección
--     introductoria del curso, que es vista previa pública (Revcurso: "que
--     la primera lección sea visible"), donde SELECT queda abierto a
--     cualquiera, incluido `anon`.
--   · INSERT: solo autenticado, con `id_usuario = auth.uid()` (nunca
--     confiar en lo que mande el cliente — el Server Action ya lo fuerza,
--     esto es el cinturón de seguridad server-side), y con el mismo acceso
--     que exige SELECT (curso vigente o lección introductoria).
--   · UPDATE (borrado lógico, columna `eliminado`): el propio autor o un
--     administrador.
--   · DELETE real: nadie — el borrado es lógico, ver el comentario del
--     modelo Comentarios en schema.prisma.
--
-- private.es_leccion_introductoria() replica en SQL la misma noción
-- posicional que ya usan src/lib/leccion.ts y src/lib/video/reproduccion.ts
-- en TypeScript: la lección de menor `orden` dentro del módulo de menor
-- `orden` del curso, y SOLO si el curso tiene más de una lección — un curso
-- de una sola clase no tiene introducción separada del contenido pagado,
-- esa única clase ES el curso completo (test:rls lo detectó primero en
-- reproduccion.ts: sin esta guarda, un curso de una lección quedaba
-- reproducible por cualquiera). No es una columna nueva — se calcula igual
-- en los tres sitios, a propósito (evita que un flag desincronizado del
-- orden real deje "vista previa" pegada a una lección que ya no es la
-- primera).
-- ============================================================

alter table public.comentarios enable row level security;
alter table public.comentario_likes enable row level security;

create or replace function private.es_leccion_introductoria(p_id_leccion uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  with curso_de_la_leccion as (
    select mm.id_curso
    from public.lecciones ll
    join public.modulos mm on mm.id = ll.id_modulo
    where ll.id = p_id_leccion
  ),
  lecciones_del_curso as (
    select l.id, m.orden as modulo_orden, l.orden as leccion_orden
    from public.lecciones l
    join public.modulos m on m.id = l.id_modulo
    where m.id_curso = (select id_curso from curso_de_la_leccion)
  )
  select (select count(*) from lecciones_del_curso) > 1
    and p_id_leccion = (
      select id from lecciones_del_curso
      order by modulo_orden, leccion_orden
      limit 1
    );
$$;

grant execute on function private.es_leccion_introductoria(uuid) to anon, authenticated;

-- `tiene_acceso_vigente_curso` (039) solo tenía grant a `authenticated`:
-- ningún llamador anónimo la necesitaba hasta ahora. La policy de abajo la
-- evalúa para CUALQUIER visitante (RLS no garantiza cortocircuito de OR por
-- posición), así que sin este grant un `anon` intentando leer comentarios
-- de una lección no-introductoria fallaría con "permission denied for
-- function" en vez de simplemente ver cero filas. Es SECURITY DEFINER: las
-- llamadas que hace por dentro (suscripcion_da_acceso, etc.) corren con los
-- privilegios de su dueño, no los de quien la invoca, así que este único
-- grant basta — y para `anon`, auth.uid() es null y la función devuelve
-- `false` de forma natural, sin abrir nada.
grant execute on function private.tiene_acceso_vigente_curso(uuid) to anon;

drop policy if exists "comentarios_select_con_acceso" on public.comentarios;
create policy "comentarios_select_con_acceso" on public.comentarios
  for select using (
    private.es_administrador()
    or private.es_leccion_introductoria(id_leccion)
    or exists (
      select 1 from public.lecciones
      join public.modulos on modulos.id = lecciones.id_modulo
      where lecciones.id = comentarios.id_leccion
        and private.tiene_acceso_vigente_curso(modulos.id_curso)
    )
  );

drop policy if exists "comentarios_insert_propio" on public.comentarios;
create policy "comentarios_insert_propio" on public.comentarios
  for insert with check (
    auth.uid() = id_usuario
    and (
      private.es_leccion_introductoria(id_leccion)
      or exists (
        select 1 from public.lecciones
        join public.modulos on modulos.id = lecciones.id_modulo
        where lecciones.id = comentarios.id_leccion
          and private.tiene_acceso_vigente_curso(modulos.id_curso)
      )
    )
  );

drop policy if exists "comentarios_update_propio_o_admin" on public.comentarios;
create policy "comentarios_update_propio_o_admin" on public.comentarios
  for update using (auth.uid() = id_usuario or private.es_administrador())
  with check (auth.uid() = id_usuario or private.es_administrador());

drop policy if exists "comentario_likes_select_si_ve_comentario" on public.comentario_likes;
create policy "comentario_likes_select_si_ve_comentario" on public.comentario_likes
  for select using (
    exists (
      select 1 from public.comentarios
      where comentarios.id = comentario_likes.id_comentario
    )
  );

drop policy if exists "comentario_likes_propio" on public.comentario_likes;
create policy "comentario_likes_propio" on public.comentario_likes
  for insert with check (auth.uid() = id_usuario);

drop policy if exists "comentario_likes_delete_propio" on public.comentario_likes;
create policy "comentario_likes_delete_propio" on public.comentario_likes
  for delete using (auth.uid() = id_usuario);
