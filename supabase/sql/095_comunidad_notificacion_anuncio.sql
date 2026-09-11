-- ============================================================
-- 095 — Notificaciones: nuevo disparador para publicaciones en ANUNCIOS
-- ============================================================
-- Mismo criterio que 094 (comunidad_respuestas_notifica_autor): un trigger
-- SECURITY DEFINER sobre la tabla de origen decide él mismo a quién avisar,
-- nunca la app. La diferencia acá es que el destinatario no es una sola
-- fila (el autor del post) sino TODOS los que tienen acceso vigente a
-- Comunidad — un verdadero broadcast, pero de blast radius acotado: la
-- policy `comunidad_posts_insert_propio` (083) ya exige ser administrador
-- para publicar en ANUNCIOS, así que solo un admin puede disparar esto.
--
-- `private.comunidad_tiene_acceso(p_id_usuario uuid)` (083) ya existe
-- parametrizada por usuario (no solo `auth.uid()`), así que enumerar a
-- todos los elegibles es un filtro directo sobre `perfiles`, sin
-- reimplementar la regla de acceso.
-- ============================================================

-- El CHECK de 094 solo permitía 'COMUNIDAD_RESPUESTA'; Postgres no deja
-- "ALTER CHECK", así que se reemplaza por la lista ampliada.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_valido;
do $$
begin
  alter table public.notificaciones
    add constraint notificaciones_tipo_valido
    check (tipo in ('COMUNIDAD_RESPUESTA', 'COMUNIDAD_ANUNCIO'));
exception
  when duplicate_object then null;
end;
$$;

create or replace function private.comunidad_notificar_anuncio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificaciones (id_usuario, tipo, id_actor, entidad_tipo, entidad_id)
  select p.id, 'COMUNIDAD_ANUNCIO', new.id_usuario, 'comunidad_post', new.id
  from public.perfiles p
  -- Nunca al propio admin que publicó el anuncio.
  where p.id <> new.id_usuario
    and private.comunidad_tiene_acceso(p.id);

  return new;
end;
$$;

drop trigger if exists comunidad_posts_notifica_anuncio on public.comunidad_posts;
create trigger comunidad_posts_notifica_anuncio
  after insert on public.comunidad_posts
  for each row
  when (new.categoria = 'ANUNCIOS')
  execute function private.comunidad_notificar_anuncio();
