-- ============================================================
-- 091 — Foto de perfil: bucket `avatares` + vista de Comunidad
-- ============================================================
-- DESPUÉS de 000-090 y de la migración de Prisma que agrega
-- `perfiles.foto_url` (20260911020000_perfiles_foto).
--
-- Público (igual que portadas-cursos, 012): una foto de perfil no protege
-- nada — se muestra en el header, en Comunidad y en cualquier lista de
-- usuarios del panel admin, siempre a gente que ya ve el nombre del dueño.
-- A diferencia de portadas-cursos (donde solo escribe un ADMINISTRADOR),
-- acá escribe cualquier usuario autenticado, pero SOLO en su propia
-- carpeta — mismo criterio de "cada quien en su carpeta" que
-- comunidad-adjuntos (086), sin necesitar consultar ninguna tabla.
--
-- Sin policy de UPDATE a propósito: cada subida usa un nombre aleatorio
-- nuevo (subirFotoPerfil, src/actions/perfil/foto.ts) y borra el archivo
-- anterior en un segundo paso — mismo patrón que subirPortadaCurso — para
-- que cambiar la foto invalide cualquier URL cacheada por el navegador en
-- vez de reescribir en el mismo path y arriesgar servir la vieja.
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatares', 'avatares', true, 3 * 1024 * 1024)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "avatares_insert_propio" on storage.objects;
create policy "avatares_insert_propio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatares_delete_propio" on storage.objects;
create policy "avatares_delete_propio" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Sin policy de SELECT: bucket.public = true ya sirve las lecturas por URL
-- conocida sin pasar por RLS (mismo comentario que 012_bucket_portadas_cursos.sql).

-- ============================================================
-- comunidad_autor_publico (085) suma foto_url — mismo criterio que
-- nombre: sin esto, el feed de Comunidad no puede mostrar la foto de
-- nadie que no sea uno mismo (RLS de `perfiles` solo deja leer la fila
-- propia). CREATE OR REPLACE en vez de drop+create: nada más cambia la
-- lista de columnas, ninguna policy ni el nombre de la vista.
-- ============================================================
create or replace view public.comunidad_autor_publico
with (security_barrier = true) as
select distinct p.id, p.nombre, p.foto_url
from public.perfiles p
where public.comunidad_tiene_acceso()
  and (
    exists (select 1 from public.comunidad_posts where id_usuario = p.id)
    or exists (select 1 from public.comunidad_respuestas where id_usuario = p.id)
  );

grant select on public.comunidad_autor_publico to authenticated;
