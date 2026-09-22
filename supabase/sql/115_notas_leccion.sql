-- ============================================================
-- notas_leccion: notas privadas con marca de tiempo ("Mis notas").
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-114, y
-- después de la migración de Prisma que crea la tabla
-- (prisma/migrations/20260921000000_notas_leccion).
--
-- Especificación completa: docs/notas-leccion.md.
--
-- Qué es esto
-- -----------
-- Un estudiante escribe una nota anclada a un segundo del video de una
-- clase. Es un apunte PERSONAL: a diferencia de `comentarios`, nadie más
-- la ve — tampoco un administrador. Romper aquí el patrón habitual
-- "propio o admin" es deliberado: no existe ninguna operación de negocio ni
-- de soporte que necesite leer los apuntes de un estudiante, y mínimo
-- privilegio manda (docs/notas-leccion.md §3.1).
--
-- Quién puede qué
-- ---------------
-- · SELECT / DELETE: solo el autor, SIN exigir acceso vigente. Si la
--   suscripción vence, el estudiante conserva sus apuntes (los ve desde
--   "Mis notas" en el dashboard, fuera del muro de pago) y siempre puede
--   borrarlos: borrar datos propios nunca se bloquea.
-- · INSERT: mismo umbral que guardar progreso (progreso_insert_propio, 076):
--   correo verificado, cuenta activa y acceso vigente al curso o lección
--   introductoria.
-- · UPDATE: el autor con cuenta activa, y solo `contenido`/`segundo`
--   (privilegio por columna). `id_usuario`, `id_leccion` e `id_video_mux`
--   son inmutables.
-- · anon: nada.
-- ============================================================

-- ------------------------------------------------------------
-- Integridad (la Server Action valida lo mismo con zod antes de llegar
-- acá; esto es la segunda capa, la que no se puede saltar con PostgREST).
-- ------------------------------------------------------------
do $$
begin
  alter table public.notas_leccion
    add constraint notas_leccion_segundo_valido
    check (segundo between 0 and 86400);
exception
  when duplicate_object then null; -- script re-corrido
end;
$$;

do $$
begin
  alter table public.notas_leccion
    add constraint notas_leccion_contenido_valido
    check (char_length(contenido) between 1 and 2000);
exception
  when duplicate_object then null;
end;
$$;

-- `actualizado_en` se escribe con supabase-js, nunca con Prisma Client: el
-- `@updatedAt` de schema.prisma no llega a la base. Mismo patrón que 102.
alter table public.notas_leccion alter column actualizado_en set default now();

drop trigger if exists set_actualizado_en on public.notas_leccion;
create trigger set_actualizado_en
  before update on public.notas_leccion
  for each row execute function private.actualiza_actualizado_en();

-- ------------------------------------------------------------
-- Al insertar:
--   · Tope de 200 notas por (usuario, lección). Es contenido privado, sin
--     costo externo ni notificaciones: no hace falta un rate limit por
--     tiempo como 106/107, solo acotar el almacenamiento. El advisory lock
--     transaccional serializa dos INSERT simultáneos del mismo par, para
--     que no puedan colarse ambos cuando el conteo va en 199.
--   · `id_video_mux` se copia de la lección y pisa lo que mande el
--     cliente: es la referencia para avisar "el video cambió" y no debe
--     poder falsearse.
-- SECURITY DEFINER porque la lectura de `lecciones` no debe depender de
-- las policies de esa tabla (el INSERT ya pasó por la suya, que es la que
-- decide el acceso); solo lee columnas de la fila NEW.
-- ------------------------------------------------------------
create or replace function private.notas_leccion_antes_de_insertar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('notas_leccion:' || new.id_usuario::text || ':' || new.id_leccion::text, 0)
  );

  select count(*) into v_total
  from public.notas_leccion
  where id_usuario = new.id_usuario
    and id_leccion = new.id_leccion;

  if v_total >= 200 then
    -- La Server Action reconoce este código y lo traduce a un mensaje claro.
    raise exception 'Llegaste al máximo de 200 notas en esta clase.'
      using errcode = 'P0N01';
  end if;

  select l.id_video_mux into new.id_video_mux
  from public.lecciones l
  where l.id = new.id_leccion;

  return new;
end;
$$;

revoke execute on function private.notas_leccion_antes_de_insertar() from public, anon, authenticated;

drop trigger if exists notas_leccion_antes_de_insertar on public.notas_leccion;
create trigger notas_leccion_antes_de_insertar
  before insert on public.notas_leccion
  for each row execute function private.notas_leccion_antes_de_insertar();

-- ============================================================
-- RLS
-- ============================================================
alter table public.notas_leccion enable row level security;

revoke all on public.notas_leccion from anon;

drop policy if exists "notas_leccion_select_propio" on public.notas_leccion;
create policy "notas_leccion_select_propio" on public.notas_leccion
  for select using ((select auth.uid()) = id_usuario);

drop policy if exists "notas_leccion_insert_propio" on public.notas_leccion;
create policy "notas_leccion_insert_propio" on public.notas_leccion
  for insert with check (
    (select auth.uid()) = id_usuario
    and (select private.correo_verificado())
    and (select private.cuenta_activa())
    and exists (
      select 1
      from public.lecciones l
      join public.modulos m on m.id = l.id_modulo
      where l.id = notas_leccion.id_leccion
        and (l.es_introductoria or private.tiene_acceso_vigente_curso(m.id_curso))
    )
  );

drop policy if exists "notas_leccion_update_propio" on public.notas_leccion;
create policy "notas_leccion_update_propio" on public.notas_leccion
  for update
  using ((select auth.uid()) = id_usuario and (select private.cuenta_activa()))
  with check ((select auth.uid()) = id_usuario);

drop policy if exists "notas_leccion_delete_propio" on public.notas_leccion;
create policy "notas_leccion_delete_propio" on public.notas_leccion
  for delete using ((select auth.uid()) = id_usuario);

-- Privilegio por columna: editar una nota es cambiar su texto o su
-- segundo, nada más. Sin esto, un UPDATE directo por PostgREST podría
-- mover la nota a otra lección (saltándose el chequeo de acceso del
-- INSERT) o reescribir `id_video_mux`.
revoke update on public.notas_leccion from authenticated;
grant update (contenido, segundo) on public.notas_leccion to authenticated;
