-- ============================================================
-- Límites de uso genéricos para las acciones con sesión — FASE 3 del plan
-- de blindaje.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-133.
--
-- El problema
-- -----------
-- Publicar en la comunidad, responder, subir adjuntos, comentar en una
-- clase, reaccionar, reportar y escribir notas no tenían tope. Con una
-- sesión (o un bot con una cuenta canjeada) se podía llenar la comunidad de
-- spam, la cola de moderación de reportes, el bucket de adjuntos o la base
-- de notas.
--
-- En la base, no solo en la app
-- -------------------------------
-- Un límite que solo vive en la Server Action se salta escribiendo directo
-- por la API de Supabase con la llave pública (RLS deja a cada uno insertar
-- su propio post). Por eso el tope lo aplica un trigger BEFORE INSERT en
-- cada tabla: vale igual para la app y para la API. La app solo traduce el
-- error (SQLSTATE `UV429`) a un mensaje. Los adjuntos son la excepción: se
-- cuentan desde la acción con `consumir_limite`, antes de procesar los
-- archivos, que es lo costoso.
--
-- El trigger no actúa sin usuario (`auth.uid()` nulo): la llave maestra,
-- los crons y el SQL del equipo no tienen tope. Si RLS rechaza la escritura
-- después, la transacción entera se revierte y el uso no queda contado.
--
-- Una función para todos, en vez de una por acción
-- ------------------------------------------------
-- Los límites que ya existen (login, canje, cupón, check-email, certificado,
-- generar examen) tienen cada uno su tabla y sus funciones, y se quedan
-- como están: funcionan y están probados. Para los nuevos hay una sola
-- tabla (`private.limites_uso`, una fila por uso) y una sola función
-- (`public.consumir_limite`).
--
-- Por qué la función NO recibe la clave ni el máximo
-- --------------------------------------------------
-- La función la llama la Server Action con la sesión del usuario, así que
-- cualquiera con sesión puede llamarla también directo por la API de
-- Supabase. Por eso:
--   - La clave es siempre `auth.uid()`: nadie puede gastar el cupo de otro.
--   - El máximo y la ventana viven aquí, en `private.limite_de_accion`: si
--     los mandara el cliente, podría pedir un máximo enorme y llenar la
--     tabla. Llamándola directo, lo más que logra alguien es gastar su
--     propio cupo, igual que usando la app.
--
-- Atómica
-- -------
-- `pg_advisory_xact_lock` por (acción, usuario) antes de contar: dos
-- peticiones simultáneas del mismo usuario se ordenan y no pasan las dos
-- con el último cupo. El candado se suelta solo al terminar la transacción
-- (cada llamada RPC es una).
--
-- Limpieza
-- --------
-- Cron diario `purgar-limites-uso` (03:50, escalonado después de 073): borra
-- las filas de más de 2 días. La ventana más larga es de 1 día.
-- ============================================================

create table if not exists private.limites_uso (
  id        bigint generated always as identity primary key,
  accion    text not null,
  clave     text not null,
  creado_en timestamptz not null default now()
);

create index if not exists limites_uso_accion_clave_creado_idx
  on private.limites_uso (accion, clave, creado_en);

-- Vive en `private` (fuera de la API de Supabase) y además con RLS sin
-- políticas: solo la tocan las funciones SECURITY DEFINER de abajo.
alter table private.limites_uso enable row level security;
revoke all on private.limites_uso from public, anon, authenticated;

-- ------------------------------------------------------------
-- Los límites, en un solo lugar. Cambiar un número aquí no toca el código
-- de la app. Los nombres de acción deben coincidir con
-- src/lib/limites-uso.ts (una prueba lo comprueba).
-- ------------------------------------------------------------
create or replace function private.limite_de_accion(p_accion text, out maximo int, out ventana interval)
language sql
immutable
set search_path = ''
as $$
  select l.maximo, l.ventana
  from (values
    ('comunidad_publicar',  10, interval '1 hour'),
    ('comunidad_responder', 30, interval '1 hour'),
    ('comunidad_adjuntos',  20, interval '1 day'),
    ('comentar',            30, interval '1 hour'),
    ('reaccionar',         120, interval '1 minute'),
    ('reportar',            10, interval '1 hour'),
    ('notas',               60, interval '1 hour')
  ) as l(accion, maximo, ventana)
  where l.accion = p_accion;
$$;

revoke execute on function private.limite_de_accion(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- El núcleo: true si había cupo (y lo gasta), false si no. Interno: recibe
-- el usuario, así que solo lo llaman las dos funciones de abajo, que lo
-- toman de auth.uid().
-- ------------------------------------------------------------
create or replace function private.consumir_limite_de(p_accion text, p_usuario uuid, p_cantidad int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_maximo  int;
  v_ventana interval;
  v_usados  int;
begin
  select l.maximo, l.ventana into v_maximo, v_ventana
  from private.limite_de_accion(p_accion) as l;

  if v_maximo is null then
    raise exception 'Acción sin límite definido: %', p_accion using errcode = '22023';
  end if;

  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'Cantidad inválida: %', p_cantidad using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_accion || ':' || p_usuario::text, 0));

  select count(*) into v_usados
  from private.limites_uso
  where accion = p_accion
    and clave = p_usuario::text
    and creado_en > now() - v_ventana;

  if v_usados + p_cantidad > v_maximo then
    return false;
  end if;

  insert into private.limites_uso (accion, clave)
  select p_accion, p_usuario::text
  from generate_series(1, p_cantidad);

  return true;
end;
$$;

revoke execute on function private.consumir_limite_de(text, uuid, int) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Para la app: hoy solo la usan los adjuntos (`p_cantidad` = archivos).
-- Llamarla directo solo gasta el cupo propio.
-- ------------------------------------------------------------
create or replace function public.consumir_limite(p_accion text, p_cantidad int default 1)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  return private.consumir_limite_de(p_accion, auth.uid(), p_cantidad);
end;
$$;

revoke execute on function public.consumir_limite(text, int) from public, anon;
grant execute on function public.consumir_limite(text, int) to authenticated;

-- ------------------------------------------------------------
-- El trigger. La acción llega como argumento del trigger.
-- ------------------------------------------------------------
create or replace function private.aplicar_limite_de_uso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    return new;
  end if;

  if not private.consumir_limite_de(tg_argv[0], v_usuario, 1) then
    raise exception 'Vas muy rápido. Espera unos minutos e inténtalo de nuevo.'
      using errcode = 'UV429', hint = tg_argv[0];
  end if;

  return new;
end;
$$;

revoke execute on function private.aplicar_limite_de_uso() from public, anon, authenticated;

drop trigger if exists limite_uso on public.comunidad_posts;
create trigger limite_uso before insert on public.comunidad_posts
  for each row execute function private.aplicar_limite_de_uso('comunidad_publicar');

drop trigger if exists limite_uso on public.comunidad_respuestas;
create trigger limite_uso before insert on public.comunidad_respuestas
  for each row execute function private.aplicar_limite_de_uso('comunidad_responder');

drop trigger if exists limite_uso on public.comentarios;
create trigger limite_uso before insert on public.comentarios
  for each row execute function private.aplicar_limite_de_uso('comentar');

-- Reacciones y likes comparten el tope. Solo al poner: quitar no hace
-- crecer nada, y volver a poner ya cuenta.
drop trigger if exists limite_uso on public.comunidad_reacciones;
create trigger limite_uso before insert on public.comunidad_reacciones
  for each row execute function private.aplicar_limite_de_uso('reaccionar');

drop trigger if exists limite_uso on public.comentario_likes;
create trigger limite_uso before insert on public.comentario_likes
  for each row execute function private.aplicar_limite_de_uso('reaccionar');

drop trigger if exists limite_uso on public.comunidad_reportes;
create trigger limite_uso before insert on public.comunidad_reportes
  for each row execute function private.aplicar_limite_de_uso('reportar');

-- Notas: crear y editar. La edición solo cuenta si cambia lo que escribe
-- la persona, no si otro proceso toca la fila.
drop trigger if exists limite_uso on public.notas_leccion;
create trigger limite_uso before insert on public.notas_leccion
  for each row execute function private.aplicar_limite_de_uso('notas');

drop trigger if exists limite_uso_editar on public.notas_leccion;
create trigger limite_uso_editar before update on public.notas_leccion
  for each row
  when (old.contenido is distinct from new.contenido or old.segundo is distinct from new.segundo)
  execute function private.aplicar_limite_de_uso('notas');

-- ------------------------------------------------------------
-- Purga diaria.
-- ------------------------------------------------------------
create or replace function private.purgar_limites_uso()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_borradas int;
begin
  delete from private.limites_uso where creado_en < now() - interval '2 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke execute on function private.purgar_limites_uso() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'purgar-limites-uso';

select cron.schedule(
  'purgar-limites-uso',
  '50 3 * * *',
  $$select private.purgar_limites_uso();$$
);
