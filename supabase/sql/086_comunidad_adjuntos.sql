-- ============================================================
-- Adjuntos de Comunidad (imagen o documento). Varios por post/respuesta,
-- insertados en el punto exacto del texto donde el autor los puso — el
-- marcador `[[adjunto:<id>]]` vive en `comunidad_posts.contenido`/
-- `comunidad_respuestas.contenido` (src/lib/formato-texto.tsx), esta tabla
-- solo guarda el archivo en sí y a qué post/respuesta pertenece.
--
-- DESPUÉS de 000-085 y de la migración de Prisma que crea
-- `comunidad_adjuntos` (20260910000000_comunidad_adjuntos).
--
-- Quién sube: cualquier suscriptor con comunidad_tiene_acceso() (no solo
-- ADMINISTRADOR) — a diferencia de materiales-lecciones/portadas-cursos
-- (011/012), este es el primer bucket donde escribe un usuario que no es
-- admin. Por eso la policy de INSERT vive acá, scoped a la propia carpeta
-- (auth.uid()) en vez de delegar en private.es_administrador().
--
-- Quién lee: NADIE directo. A propósito no hay policy de SELECT en
-- storage.objects (ni admin-only ni abierta): la autorización de lectura
-- vive enteramente en la tabla `comunidad_adjuntos` (RLS de abajo, mismo
-- criterio que comunidad_posts/comunidad_respuestas), y la URL firmada se
-- genera con el cliente de Service Role SOLO después de confirmar esa fila
-- — mismo patrón en dos pasos que obtenerUrlRecurso (src/actions/cursos/
-- recurso.ts) contra materiales-lecciones. Evita mantener dos superficies
-- de autorización (tabla + Storage) que puedan desincronizarse.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('comunidad-adjuntos', 'comunidad-adjuntos', false, 10 * 1024 * 1024)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Ruta de cada objeto: "{auth.uid()}/{id_post o id_respuesta}.{extension}"
-- (armada en src/lib/comunidad-adjuntos.ts) — storage.foldername(name)[1]
-- es ese primer segmento, así que esta policy es "cada quien escribe solo
-- en su propia carpeta", sin necesitar consultar ninguna tabla.
drop policy if exists "comunidad_adjuntos_insert_propio" on storage.objects;
create policy "comunidad_adjuntos_insert_propio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comunidad-adjuntos'
    and public.comunidad_tiene_acceso()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Borrado propio (el autor borra su publicación) o de un ADMINISTRADOR
-- moderando la publicación de otra persona — mismo criterio que
-- comunidad_posts_update_propio_o_admin (083), aplicado acá porque
-- eliminarPostComunidad/eliminarRespuestaComunidad (src/actions/comunidad/
-- eliminar.ts) corren con el cliente de sesión de quien borra, nunca con
-- Service Role.
drop policy if exists "comunidad_adjuntos_delete_propio_o_admin" on storage.objects;
create policy "comunidad_adjuntos_delete_propio_o_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comunidad-adjuntos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or private.es_administrador())
  );

-- ------------------------------------------------------------
-- RLS: comunidad_adjuntos
--
-- · SELECT: cualquiera con comunidad_tiene_acceso() — mismo criterio que
--   comunidad_posts/comunidad_respuestas, porque un adjunto solo tiene
--   sentido junto al post/respuesta al que pertenece, ya visible para toda
--   la comunidad.
-- · INSERT: el propio usuario, y solo sobre un post/respuesta que sea
--   SUYO — nadie puede colgarle un archivo a una publicación ajena. Varios
--   por post/respuesta (MAX_ADJUNTOS_COMUNIDAD en comunidad-tipos.ts pone
--   el límite práctico, no hay tope a nivel de base).
-- · Sin UPDATE: inmutable por diseño — se borra y se vuelve a adjuntar.
-- · DELETE: el propio autor o un ADMINISTRADOR moderando.
-- ------------------------------------------------------------
do $$
begin
  alter table public.comunidad_adjuntos
    add constraint comunidad_adjuntos_exactamente_uno
    check (
      (id_post is not null and id_respuesta is null)
      or (id_post is null and id_respuesta is not null)
    );
exception
  when duplicate_object then null;
end;
$$;

-- Este script llegó a crear un índice único parcial por post/respuesta
-- (un solo adjunto) antes de que se decidiera permitir varios — se
-- eliminan explícitamente por si ya corrieron en esta base, en vez de
-- dejarlos como deuda silenciosa esperando a que alguien los redescubra.
drop index if exists comunidad_adjuntos_post_unico;
drop index if exists comunidad_adjuntos_respuesta_unico;

alter table public.comunidad_adjuntos enable row level security;

drop policy if exists "comunidad_adjuntos_select_con_acceso" on public.comunidad_adjuntos;
create policy "comunidad_adjuntos_select_con_acceso" on public.comunidad_adjuntos
  for select using (public.comunidad_tiene_acceso());

drop policy if exists "comunidad_adjuntos_insert_propio" on public.comunidad_adjuntos;
create policy "comunidad_adjuntos_insert_propio" on public.comunidad_adjuntos
  for insert with check (
    (select auth.uid()) = id_usuario
    and public.comunidad_tiene_acceso()
    and (
      (id_post is not null and exists (
        select 1 from public.comunidad_posts p where p.id = id_post and p.id_usuario = (select auth.uid())
      ))
      or
      (id_respuesta is not null and exists (
        select 1 from public.comunidad_respuestas r where r.id = id_respuesta and r.id_usuario = (select auth.uid())
      ))
    )
  );

drop policy if exists "comunidad_adjuntos_delete_propio_o_admin" on public.comunidad_adjuntos;
create policy "comunidad_adjuntos_delete_propio_o_admin" on public.comunidad_adjuntos
  for delete using ((select auth.uid()) = id_usuario or private.es_administrador());

revoke update on public.comunidad_adjuntos from anon;
revoke update on public.comunidad_adjuntos from authenticated;
