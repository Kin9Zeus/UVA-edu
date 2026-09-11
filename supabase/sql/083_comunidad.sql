-- ============================================================
-- Row Level Security (RLS): Comunidad — F1 del plan
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-082, y
-- después de correr la migración de Prisma que crea `configuracion_comunidad`,
-- `comunidad_posts`, `comunidad_respuestas`, `comunidad_reacciones` y
-- `comunidad_moderacion`.
--
-- Gate de acceso (decidido en la conversación de diseño de sept. 2026):
--   · Mientras `now() < configuracion_comunidad.fin_bootstrap`: cualquier
--     usuario con suscripción vigente entra — sin excepción para nadie,
--     incluidos los migrados de WhatsApp. No hay mecanismo de gracia por
--     usuario.
--   · Pasado el bootstrap: exige certificado emitido en los últimos 30 días
--     (curso completado y nuevo, no un curso viejo revisitado).
--   · ADMINISTRADOR siempre entra, en cualquier momento — necesita poder
--     moderar sin depender de haber tomado un curso.
-- Una sola fuente de verdad en SQL (private.comunidad_tiene_acceso), mismo
-- criterio que private.curso_esta_completo (068): la app consulta el
-- wrapper público, nunca reimplementa la regla en TypeScript.
-- ============================================================

-- ------------------------------------------------------------
-- configuracion_comunidad: fila única. El CHECK (id = 1) es lo que impide
-- una segunda fila — no hay forma declarativa de forzar "máximo una fila" en
-- Postgres salvo fijar la PK a un valor constante.
-- ------------------------------------------------------------
do $$
begin
  alter table public.configuracion_comunidad
    add constraint configuracion_comunidad_id_unico check (id = 1);
exception
  when duplicate_object then null; -- ya existe, script re-corrido sin problema
end;
$$;

-- Semilla obligatoria: sin fila, comunidad_bootstrap_activo() no tiene de
-- dónde leer y el gate se cerraría para todos. 40 días desde el despliegue
-- de este archivo — ajustar con una fecha real antes de lanzar (ver el
-- riesgo señalado en la conversación de diseño: esto es una fila editable
-- desde el Panel Admin, no una constante de código, precisamente para poder
-- moverla sin deploy).
insert into public.configuracion_comunidad (id, fin_bootstrap, actualizado_en)
values (1, now() + interval '40 days', now())
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Exclusividad: una reacción o una moderación apuntan a un post O a una
-- respuesta, nunca a ambos ni a ninguno. Prisma no expresa esto de forma
-- nativa (igual que las parciales de Suscripciones, ver el comentario en
-- schema.prisma) — vive como CHECK crudo.
-- ------------------------------------------------------------
do $$
begin
  alter table public.comunidad_reacciones
    add constraint comunidad_reacciones_exactamente_uno
    check (num_nonnulls(id_post, id_respuesta) = 1);
exception
  when duplicate_object then null; -- ya existe, script re-corrido sin problema
end;
$$;

do $$
begin
  alter table public.comunidad_moderacion
    add constraint comunidad_moderacion_exactamente_uno
    check (num_nonnulls(id_post, id_respuesta) = 1);
exception
  when duplicate_object then null; -- ya existe, script re-corrido sin problema
end;
$$;

-- Un usuario reacciona una sola vez al mismo post/respuesta. Dos índices
-- parciales en vez de un único compuesto porque la fila solo llena una de
-- las dos columnas por vez (ver el CHECK de arriba).
create unique index if not exists comunidad_reacciones_post_unica_por_usuario
  on public.comunidad_reacciones (id_usuario, id_post)
  where id_post is not null;

create unique index if not exists comunidad_reacciones_respuesta_unica_por_usuario
  on public.comunidad_reacciones (id_usuario, id_respuesta)
  where id_respuesta is not null;

-- ============================================================
-- Funciones de acceso
-- ============================================================

create or replace function private.comunidad_activo_por_certificado(p_id_usuario uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.certificados
    where id_usuario = p_id_usuario
      and fecha_emision >= now() - interval '30 days'
  );
$$;

revoke execute on function private.comunidad_activo_por_certificado(uuid) from public;
grant execute on function private.comunidad_activo_por_certificado(uuid) to authenticated;

create or replace function private.comunidad_bootstrap_activo()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select now() < fin_bootstrap from public.configuracion_comunidad where id = 1;
$$;

revoke execute on function private.comunidad_bootstrap_activo() from public;
grant execute on function private.comunidad_bootstrap_activo() to authenticated;

-- Fuente de verdad única del gate. `suscripcion_da_acceso` (038/043) ya
-- existe y es exactamente "¿este usuario tiene membresía vigente?" — no se
-- reimplementa acá.
create or replace function private.comunidad_tiene_acceso(p_id_usuario uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.perfiles
      where id = p_id_usuario and rol = 'ADMINISTRADOR'
    )
    or private.comunidad_activo_por_certificado(p_id_usuario)
    or (
      private.comunidad_bootstrap_activo()
      and private.suscripcion_da_acceso(p_id_usuario)
    );
$$;

revoke execute on function private.comunidad_tiene_acceso(uuid) from public;
grant execute on function private.comunidad_tiene_acceso(uuid) to authenticated;

-- Wrapper sin parámetro para la app y para las policies: siempre responde
-- por auth.uid(), mismo motivo que public.curso_esta_completo (068) — nadie
-- puede usarlo para consultar el acceso de otro usuario.
create or replace function public.comunidad_tiene_acceso()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select private.comunidad_tiene_acceso((select auth.uid()));
$$;

revoke execute on function public.comunidad_tiene_acceso() from public;
grant execute on function public.comunidad_tiene_acceso() to authenticated;

-- Lectura de la fecha de corte para la UI (banner "vence en X días" y el
-- 403 de bootstrap) sin abrir SELECT directo sobre configuracion_comunidad
-- a estudiantes.
create or replace function public.comunidad_fin_bootstrap()
returns timestamptz
language sql
security definer set search_path = public
stable
as $$
  select fin_bootstrap from public.configuracion_comunidad where id = 1;
$$;

revoke execute on function public.comunidad_fin_bootstrap() from public;
grant execute on function public.comunidad_fin_bootstrap() to authenticated;

create or replace function public.comunidad_bootstrap_activo()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select private.comunidad_bootstrap_activo();
$$;

revoke execute on function public.comunidad_bootstrap_activo() from public;
grant execute on function public.comunidad_bootstrap_activo() to authenticated;

-- ============================================================
-- RLS: configuracion_comunidad
--
-- Es una tabla de configuración administrativa: nadie salvo un admin la lee
-- ni la escribe directo. Los estudiantes la consultan solo a través de los
-- wrappers de arriba (SECURITY DEFINER), nunca por SELECT sobre la tabla.
-- ============================================================
alter table public.configuracion_comunidad enable row level security;

drop policy if exists "configuracion_comunidad_select_admin" on public.configuracion_comunidad;
create policy "configuracion_comunidad_select_admin" on public.configuracion_comunidad
  for select using (private.es_administrador());

drop policy if exists "configuracion_comunidad_update_admin" on public.configuracion_comunidad;
create policy "configuracion_comunidad_update_admin" on public.configuracion_comunidad
  for update using (private.es_administrador())
  with check (private.es_administrador() and (select auth.uid()) = actualizado_por);

-- ============================================================
-- RLS: comunidad_posts
--
-- · SELECT: cualquiera con comunidad_tiene_acceso().
-- · INSERT: mismo gate + correo_verificado() + cuenta_activa() (patrón fijo
--   de 019 en toda escritura del proyecto) + nunca fijado=true (eso es
--   exclusivo de un admin, después de creado) + ANUNCIOS solo lo publica un
--   administrador.
-- · UPDATE: el propio autor o un admin pueden tocar la fila (mismo criterio
--   que comentarios_update_propio_o_admin, 052/056) — qué COLUMNA puede
--   tocar cada uno se resuelve abajo con privilegio por columna + triggers,
--   no aquí (RLS decide filas, no columnas — mismo razonamiento que 064).
-- · DELETE real: nadie, borrado lógico únicamente.
-- ============================================================
alter table public.comunidad_posts enable row level security;

drop policy if exists "comunidad_posts_select_con_acceso" on public.comunidad_posts;
create policy "comunidad_posts_select_con_acceso" on public.comunidad_posts
  for select using (public.comunidad_tiene_acceso());

drop policy if exists "comunidad_posts_insert_propio" on public.comunidad_posts;
create policy "comunidad_posts_insert_propio" on public.comunidad_posts
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and public.comunidad_tiene_acceso()
    and fijado = false
    and (categoria <> 'ANUNCIOS' or private.es_administrador())
  );

drop policy if exists "comunidad_posts_update_propio_o_admin" on public.comunidad_posts;
create policy "comunidad_posts_update_propio_o_admin" on public.comunidad_posts
  for update using ((select auth.uid()) = id_usuario or private.es_administrador())
  with check ((select auth.uid()) = id_usuario or private.es_administrador());

-- Capa 1 — privilegio por columna (mismo patrón que 064): la app solo
-- necesita escribir eliminado (autor o admin), fijado (admin) y
-- contenido/titulo (únicamente para vaciarlos al moderar, capa 2).
revoke update on public.comunidad_posts from anon;
revoke update on public.comunidad_posts from authenticated;
grant update (eliminado, fijado, contenido, titulo) on public.comunidad_posts to authenticated;

-- Capa 2 — las transiciones concretas que el privilegio de columna no
-- distingue por sí solo (mismo razonamiento que 064/065 sobre comentarios):
--   · fijado solo lo cambia un administrador, en cualquier dirección.
--   · eliminado: cualquiera con permiso de UPDATE puede pasar a true (borrar
--     lo suyo); solo un admin puede pasar de true a false (deshacer una
--     moderación, no solo la propia).
--   · contenido/titulo: la única transición válida es vaciarlos al eliminar
--     — nunca reescribirlos con texto nuevo, ni el autor ni un admin.
create or replace function private.comunidad_posts_transiciones_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fijado is distinct from old.fijado and not private.es_administrador() then
    raise exception 'Fijar o desfijar una publicación requiere un administrador.'
      using errcode = 'check_violation';
  end if;

  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Una publicación eliminada solo puede restaurarla un administrador.'
      using errcode = 'check_violation';
  end if;

  if new.contenido is distinct from old.contenido and new.contenido <> '' then
    raise exception 'El contenido de una publicación no se puede reescribir, solo vaciar al eliminarla.'
      using errcode = 'check_violation';
  end if;

  if new.titulo is distinct from old.titulo and new.titulo <> '' then
    raise exception 'El título de una publicación no se puede reescribir, solo vaciar al eliminarla.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists comunidad_posts_transiciones_permitidas on public.comunidad_posts;
create trigger comunidad_posts_transiciones_permitidas
  before update on public.comunidad_posts
  for each row execute function private.comunidad_posts_transiciones_permitidas();

-- ============================================================
-- RLS: comunidad_respuestas — mismo criterio que comunidad_posts, sin
-- fijado (esa columna no existe en respuestas).
-- ============================================================
alter table public.comunidad_respuestas enable row level security;

drop policy if exists "comunidad_respuestas_select_con_acceso" on public.comunidad_respuestas;
create policy "comunidad_respuestas_select_con_acceso" on public.comunidad_respuestas
  for select using (public.comunidad_tiene_acceso());

drop policy if exists "comunidad_respuestas_insert_propio" on public.comunidad_respuestas;
create policy "comunidad_respuestas_insert_propio" on public.comunidad_respuestas
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and public.comunidad_tiene_acceso()
  );

drop policy if exists "comunidad_respuestas_update_propio_o_admin" on public.comunidad_respuestas;
create policy "comunidad_respuestas_update_propio_o_admin" on public.comunidad_respuestas
  for update using ((select auth.uid()) = id_usuario or private.es_administrador())
  with check ((select auth.uid()) = id_usuario or private.es_administrador());

revoke update on public.comunidad_respuestas from anon;
revoke update on public.comunidad_respuestas from authenticated;
grant update (eliminado, contenido) on public.comunidad_respuestas to authenticated;

create or replace function private.comunidad_respuestas_transiciones_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Una respuesta eliminada solo puede restaurarla un administrador.'
      using errcode = 'check_violation';
  end if;

  if new.contenido is distinct from old.contenido and new.contenido <> '' then
    raise exception 'El contenido de una respuesta no se puede reescribir, solo vaciar al eliminarla.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists comunidad_respuestas_transiciones_permitidas on public.comunidad_respuestas;
create trigger comunidad_respuestas_transiciones_permitidas
  before update on public.comunidad_respuestas
  for each row execute function private.comunidad_respuestas_transiciones_permitidas();

-- ============================================================
-- RLS: comunidad_reacciones — mismo criterio que comentario_likes (052):
-- SELECT abierto a quien tiene acceso a la comunidad, INSERT/DELETE solo
-- de la fila propia. Sin UPDATE: una reacción se quita y se vuelve a poner,
-- no se edita.
-- ============================================================
alter table public.comunidad_reacciones enable row level security;

drop policy if exists "comunidad_reacciones_select_con_acceso" on public.comunidad_reacciones;
create policy "comunidad_reacciones_select_con_acceso" on public.comunidad_reacciones
  for select using (public.comunidad_tiene_acceso());

drop policy if exists "comunidad_reacciones_insert_propio" on public.comunidad_reacciones;
create policy "comunidad_reacciones_insert_propio" on public.comunidad_reacciones
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and public.comunidad_tiene_acceso()
  );

drop policy if exists "comunidad_reacciones_delete_propio" on public.comunidad_reacciones;
create policy "comunidad_reacciones_delete_propio" on public.comunidad_reacciones
  for delete using ((select auth.uid()) = id_usuario);

revoke update on public.comunidad_reacciones from anon;
revoke update on public.comunidad_reacciones from authenticated;

-- ============================================================
-- RLS: comunidad_moderacion — calca comentario_moderacion (065) exacto:
-- evidencia sensible, cerrada a todo el que no sea administrador, incluido
-- el propio autor del post/respuesta moderado. Sin UPDATE/DELETE: es
-- bitácora, no se edita ni se borra.
-- ============================================================
alter table public.comunidad_moderacion enable row level security;

drop policy if exists "comunidad_moderacion_select_admin" on public.comunidad_moderacion;
create policy "comunidad_moderacion_select_admin" on public.comunidad_moderacion
  for select using (private.es_administrador());

drop policy if exists "comunidad_moderacion_insert_admin" on public.comunidad_moderacion;
create policy "comunidad_moderacion_insert_admin" on public.comunidad_moderacion
  for insert with check (
    private.es_administrador() and (select auth.uid()) = id_eliminado_por
  );

revoke update on public.comunidad_moderacion from anon;
revoke update on public.comunidad_moderacion from authenticated;
revoke delete on public.comunidad_moderacion from anon;
revoke delete on public.comunidad_moderacion from authenticated;
