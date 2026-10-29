-- ============================================================
-- textos_legales: términos, datos personales, privacidad, cookies y normas
-- de la comunidad, con su historial de versiones.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-129, y
-- después de la migración de Prisma que crea la tabla
-- (prisma/migrations/20261029000000_textos_legales).
--
-- Qué es esto
-- -----------
-- Cada fila es una VERSIÓN de un texto. El visitante ve, por `slug`, la
-- versión PUBLICADA con `vigente_desde` más reciente que ya haya llegado.
-- Los textos viven aquí y no escritos a mano en un componente porque cada
-- versión publicada tiene que conservarse: la Ley 1581 exige poder probar qué
-- texto aceptó cada persona, y esa prueba es la versión + la fecha.
--
-- Quién puede qué
-- ---------------
-- · anon / authenticated: SELECT solo de filas PUBLICADAS cuya vigencia ya
--   llegó. Un borrador o una versión con vigencia futura no se ve.
-- · ADMINISTRADOR: todo (ve borradores, crea, edita borradores, publica).
-- · Nadie más escribe. Los scripts de siembra y publicación
--   (scripts/legal/*) usan la service role, que no pasa por RLS.
--
-- Inmutabilidad
-- -------------
-- Una fila PUBLICADA no se edita ni se borra, ni siquiera con la service
-- role (trigger). Corregir un texto vigente es publicar una versión nueva.
-- Lo único permitido sobre una fila es pasar de BORRADOR a PUBLICADO, una
-- sola vez. Mismo criterio que bitacora_administrativa (069/074): se prefiere
-- el borrado imposible por accidente a uno que dependa de la disciplina de
-- quien tenga la llave.
--
-- La única puerta de borrado es public.purgar_texto_legal_de_prueba(), y
-- solo borra versiones cuyo nombre empieza por `rls-test-`: existe para que
-- `npm run test:rls` pueda limpiar lo que crea sin dejar basura permanente
-- en un texto que, por diseño, nadie puede borrar. Una versión real
-- ("1.0", "2.0") nunca coincide con ese prefijo.
--
-- Idempotente: se puede re-correr sin efecto (ver README de esta carpeta).
-- ============================================================

-- ------------------------------------------------------------
-- Integridad (el script de publicación valida lo mismo antes de llegar
-- acá; esto es la segunda capa, la que no se puede saltar con PostgREST).
-- ------------------------------------------------------------
do $$
begin
  alter table public.textos_legales
    add constraint textos_legales_slug_valido
    check (slug in ('terminos', 'datos-personales', 'privacidad', 'cookies', 'comunidad'));
exception
  when duplicate_object then null; -- script re-corrido
end;
$$;

do $$
begin
  alter table public.textos_legales
    add constraint textos_legales_estado_valido
    check (estado in ('BORRADOR', 'PUBLICADO'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.textos_legales
    add constraint textos_legales_version_valida
    check (char_length(version) between 1 and 40 and version = btrim(version));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.textos_legales
    add constraint textos_legales_titulo_valido
    check (char_length(btrim(titulo)) between 1 and 200);
exception
  when duplicate_object then null;
end;
$$;

-- El contenido es una lista de bloques (src/lib/legal/bloques.ts). Aquí solo
-- se exige que sea una lista: la forma de cada bloque la valida zod al leer.
do $$
begin
  alter table public.textos_legales
    add constraint textos_legales_contenido_es_lista
    check (jsonb_typeof(contenido) = 'array');
exception
  when duplicate_object then null;
end;
$$;

-- Un texto publicado siempre dice desde cuándo rige y cuándo se publicó.
do $$
begin
  alter table public.textos_legales
    add constraint textos_legales_publicado_con_fechas
    check (estado <> 'PUBLICADO' or (vigente_desde is not null and publicado_en is not null));
exception
  when duplicate_object then null;
end;
$$;

-- ------------------------------------------------------------
-- Inmutabilidad de lo publicado.
--
-- BEFORE INSERT OR UPDATE: al quedar PUBLICADA una fila sin `publicado_en`,
-- se estampa con la hora del servidor (así el script no puede falsearla y la
-- CHECK de arriba, que se evalúa DESPUÉS de este trigger, la encuentra).
-- BEFORE UPDATE: una fila ya PUBLICADA no admite ningún cambio.
-- BEFORE DELETE: una fila PUBLICADA no se borra, salvo por la puerta de
-- purga de pruebas (GUC local a la transacción, como en 074).
-- ------------------------------------------------------------
create or replace function private.textos_legales_guarda()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'PUBLICADO'
       and coalesce(current_setting('uva.purga_textos_legales', true), 'off') <> 'on' then
      raise exception 'textos_legales: una versión publicada no se borra; publica una versión nueva.'
        using errcode = '42501'; -- insufficient_privilege
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.estado = 'PUBLICADO' then
    raise exception 'textos_legales: una versión publicada no se edita; publica una versión nueva.'
      using errcode = '42501';
  end if;

  if new.estado = 'PUBLICADO' and new.publicado_en is null then
    new.publicado_en := now();
  end if;

  return new;
end;
$$;

revoke execute on function private.textos_legales_guarda() from public, anon, authenticated;

drop trigger if exists textos_legales_guarda on public.textos_legales;
create trigger textos_legales_guarda
  before insert or update or delete on public.textos_legales
  for each row execute function private.textos_legales_guarda();

-- La única puerta de borrado de una versión publicada. Vive en `public`
-- porque tiene que ser invocable como RPC desde supabase-js, pero solo
-- `service_role` la tiene concedida. Y solo toca versiones `rls-test-*`.
create or replace function public.purgar_texto_legal_de_prueba(p_version text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_borradas integer;
begin
  if p_version is null or p_version not like 'rls-test-%' then
    raise exception 'purgar_texto_legal_de_prueba solo borra versiones de prueba (prefijo rls-test-).'
      using errcode = '42501';
  end if;

  perform set_config('uva.purga_textos_legales', 'on', true);
  delete from public.textos_legales where version = p_version;
  get diagnostics v_borradas = row_count;
  -- Se apaga explícitamente aunque el `true` de set_config ya lo limite a
  -- esta transacción (mismo cuidado que purgar_bitacora_de_admin, 074).
  perform set_config('uva.purga_textos_legales', 'off', true);
  return v_borradas;
end;
$$;

revoke execute on function public.purgar_texto_legal_de_prueba(text) from public, anon, authenticated;
grant execute on function public.purgar_texto_legal_de_prueba(text) to service_role;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.textos_legales enable row level security;

-- anon solo lee; authenticated conserva sus privilegios de tabla y es la
-- política de abajo la que reduce la escritura al administrador.
revoke all on public.textos_legales from anon;
grant select on public.textos_legales to anon;

drop policy if exists "textos_legales_select_publicado" on public.textos_legales;
create policy "textos_legales_select_publicado" on public.textos_legales
  for select using (
    (estado = 'PUBLICADO' and vigente_desde <= now())
    or (select private.es_administrador())
  );

drop policy if exists "textos_legales_admin_escritura" on public.textos_legales;
create policy "textos_legales_admin_escritura" on public.textos_legales
  for all using ((select private.es_administrador()))
  with check ((select private.es_administrador()));
