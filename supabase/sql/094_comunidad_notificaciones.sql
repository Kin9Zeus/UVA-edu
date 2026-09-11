-- ============================================================
-- 094 — Notificaciones in-app: primer disparador (te respondieron un post)
-- ============================================================
-- DESPUÉS de 000-093 y de la migración de Prisma que crea `notificaciones`
-- (20260911030000_notificaciones).
--
-- Diseño: tabla genérica (id_usuario destinatario, tipo, id_actor, entidad),
-- pero SIN policy de INSERT para `authenticated` — nadie inserta una
-- notificación "a mano" desde una Server Action. La única puerta es un
-- trigger SECURITY DEFINER sobre la tabla de origen (acá,
-- comunidad_respuestas), que decide él mismo quién es el destinatario
-- legítimo leyendo comunidad_posts.id_usuario — nunca confiando en un
-- `id_usuario` que mandara el cliente. Mismo criterio exacto que
-- `intento_examen_emite_certificado` (068_certificado_requiere_examen.sql):
-- un efecto de sistema no se le pide de favor a la app, se garantiza en la
-- base. Agregar un segundo disparador (reacciones, anuncios) más adelante
-- es sumar OTRO trigger sobre SU tabla de origen, sin tocar este.
-- ============================================================

do $$
begin
  alter table public.notificaciones
    add constraint notificaciones_tipo_valido
    check (tipo in ('COMUNIDAD_RESPUESTA'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.notificaciones
    add constraint notificaciones_entidad_tipo_valido
    check (entidad_tipo in ('comunidad_post'));
exception
  when duplicate_object then null;
end;
$$;

alter table public.notificaciones enable row level security;

drop policy if exists "notificaciones_select_propio" on public.notificaciones;
create policy "notificaciones_select_propio" on public.notificaciones
  for select using ((select auth.uid()) = id_usuario);

-- UPDATE: cada quien marca las suyas como leídas, nunca reescribe de qué
-- se trata la notificación ni a quién le llegó.
drop policy if exists "notificaciones_update_propio" on public.notificaciones;
create policy "notificaciones_update_propio" on public.notificaciones
  for update using ((select auth.uid()) = id_usuario) with check ((select auth.uid()) = id_usuario);

revoke update on public.notificaciones from anon;
revoke update on public.notificaciones from authenticated;
grant update (leida) on public.notificaciones to authenticated;

-- Sin policy de INSERT ni DELETE para `authenticated`/`anon` a propósito
-- (ver cabecera): quedan cerradas del todo, el trigger de abajo corre con
-- privilegio propio y no necesita ningún GRANT para escribir.
revoke insert on public.notificaciones from anon;
revoke insert on public.notificaciones from authenticated;
revoke delete on public.notificaciones from anon;
revoke delete on public.notificaciones from authenticated;

create or replace function private.comunidad_notificar_respuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor_post uuid;
begin
  select id_usuario into v_autor_post from public.comunidad_posts where id = new.id_post;

  -- Sin post encontrado (no debería pasar, la FK lo garantiza) o
  -- respondiéndote a ti mismo: no hay a quién avisar.
  if v_autor_post is null or v_autor_post = new.id_usuario then
    return new;
  end if;

  insert into public.notificaciones (id_usuario, tipo, id_actor, entidad_tipo, entidad_id)
  values (v_autor_post, 'COMUNIDAD_RESPUESTA', new.id_usuario, 'comunidad_post', new.id_post);

  return new;
end;
$$;

drop trigger if exists comunidad_respuestas_notifica_autor on public.comunidad_respuestas;
create trigger comunidad_respuestas_notifica_autor
  after insert on public.comunidad_respuestas
  for each row
  execute function private.comunidad_notificar_respuesta();
