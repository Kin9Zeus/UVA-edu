-- ============================================================
-- 126 — Comunidad: responder a una respuesta (un solo nivel)
-- ============================================================
-- DESPUÉS de 000-125 y de la migración de Prisma
-- 20261019000000_comunidad_respuesta_a_respuesta (que agrega la columna
-- `id_respuesta_padre` a `comunidad_respuestas`).
--
-- Reglas que viven en la base, no en la app (la app solo mejora el mensaje):
--   1. Un solo nivel: la respuesta a la que se contesta es "principal" (no
--      tiene padre) y es del MISMO post. Contestar a una respuesta de un
--      hilo se hace contra la principal de ese hilo (lo resuelve la acción).
--   2. Notificaciones: contestar a una respuesta avisa a su autor
--      ('COMUNIDAD_RESPUESTA_A_RESPUESTA'); el autor del post sigue
--      recibiendo 'COMUNIDAD_RESPUESTA', salvo que sea el mismo que ya
--      recibió el aviso anterior (no se le avisa dos veces de lo mismo).
-- ============================================================

create or replace function private.comunidad_respuesta_padre_valido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post uuid;
  v_abuelo uuid;
begin
  if new.id_respuesta_padre is null then
    return new;
  end if;

  select id_post, id_respuesta_padre into v_post, v_abuelo
  from public.comunidad_respuestas
  where id = new.id_respuesta_padre;

  if not found then
    raise exception 'La respuesta a la que contestas no existe.'
      using errcode = 'check_violation';
  end if;

  if v_post <> new.id_post then
    raise exception 'La respuesta a la que contestas es de otra publicación.'
      using errcode = 'check_violation';
  end if;

  if v_abuelo is not null then
    raise exception 'Solo se puede contestar a una respuesta principal, no a otra respuesta de un hilo.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists comunidad_respuestas_padre_valido on public.comunidad_respuestas;
create trigger comunidad_respuestas_padre_valido
  before insert on public.comunidad_respuestas
  for each row
  execute function private.comunidad_respuesta_padre_valido();

-- El CHECK de 103 no conoce el tipo nuevo; se reemplaza por la lista
-- ampliada (mismo patrón que 095/100/103).
alter table public.notificaciones drop constraint if exists notificaciones_tipo_valido;
do $$
begin
  alter table public.notificaciones
    add constraint notificaciones_tipo_valido
    check (tipo in (
      'COMUNIDAD_RESPUESTA',
      'COMUNIDAD_RESPUESTA_A_RESPUESTA',
      'COMUNIDAD_ANUNCIO',
      'COMUNIDAD_MODERACION',
      'COMUNIDAD_REPORTE_ELIMINADO',
      'COMUNIDAD_REPORTE_DESCARTADO'
    ));
exception
  when duplicate_object then null;
  -- Ver el comentario equivalente en 094/100: el pipeline reaplica todos los
  -- archivos contra la base viva; el CHECK que importa es el del último
  -- archivo que toca `tipo`.
  when check_violation then null;
end;
$$;

create or replace function private.comunidad_notificar_respuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor_post uuid;
  v_autor_padre uuid;
begin
  select id_usuario into v_autor_post from public.comunidad_posts where id = new.id_post;

  if new.id_respuesta_padre is not null then
    select id_usuario into v_autor_padre
    from public.comunidad_respuestas
    where id = new.id_respuesta_padre;

    if v_autor_padre is not null and v_autor_padre <> new.id_usuario then
      insert into public.notificaciones (id_usuario, tipo, id_actor, entidad_tipo, entidad_id)
      values (v_autor_padre, 'COMUNIDAD_RESPUESTA_A_RESPUESTA', new.id_usuario, 'comunidad_post', new.id_post);
    end if;
  end if;

  -- Sin post encontrado (no debería pasar, la FK lo garantiza), respondiéndote
  -- a ti mismo, o ya avisado como autor de la respuesta contestada: no hay a
  -- quién más avisar.
  if v_autor_post is not null
     and v_autor_post <> new.id_usuario
     and v_autor_post is distinct from v_autor_padre then
    insert into public.notificaciones (id_usuario, tipo, id_actor, entidad_tipo, entidad_id)
    values (v_autor_post, 'COMUNIDAD_RESPUESTA', new.id_usuario, 'comunidad_post', new.id_post);
  end if;

  return new;
end;
$$;
