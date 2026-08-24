-- ============================================================
-- Row Level Security (RLS)
-- Ver docs/technical-spec.md §5 (Seguridad y RLS).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de correr las
-- migraciones de Prisma y el trigger de 000_trigger_perfiles.sql.
--
-- Regla general: se activa RLS en TODAS las tablas. Las tablas sin
-- política explícita quedan bloqueadas para los roles `anon`/
-- `authenticated` (solo el Service Role Key, que Prisma/webhooks
-- usan vía src/lib/supabase/admin.ts, puede leerlas/escribirlas).
-- Esto es intencional: las tablas administrativas (planes,
-- suscripciones, pagos, cupones, cursos en modo escritura, etc.)
-- se abrirán con políticas propias en la Fase 2/4 del
-- development-plan.md, cuando se construya el panel admin y el
-- muro de acceso — no se inventan reglas de negocio aquí todavía.
-- ============================================================

-- Tabla interna de Prisma (historial de migraciones). No contiene datos de
-- negocio, pero al vivir en `public` queda expuesta por la API automática
-- de Supabase (PostgREST) — se bloquea por completo, sin políticas.
alter table public._prisma_migrations enable row level security;

alter table public.perfiles enable row level security;
alter table public.planes enable row level security;
alter table public.suscripciones enable row level security;
alter table public.pagos enable row level security;
alter table public.categorias enable row level security;
alter table public.cursos enable row level security;
alter table public.modulos enable row level security;
alter table public.lecciones enable row level security;
alter table public.progreso enable row level security;
alter table public.certificados enable row level security;
alter table public.cupones enable row level security;
alter table public.inscripciones enable row level security;
alter table public.bitacora_administrativa enable row level security;
alter table public.eventos_webhook enable row level security;
alter table public.recursos_descargables enable row level security;

-- Helper: ¿el usuario autenticado actual es administrador?
--
-- Vive en el schema `private` (no `public`) a propósito: Supabase expone
-- automáticamente toda función en `public` como endpoint REST
-- (/rest/v1/rpc/es_administrador), aunque sea SECURITY DEFINER y solo se
-- use dentro de políticas RLS. `private` no está en la lista de schemas
-- expuestos por PostgREST, así que deja de ser invocable por HTTP — pero
-- las políticas de abajo (evaluadas con los privilegios de anon/
-- authenticated) sí pueden seguir llamándola, por eso el GRANT USAGE.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.es_administrador()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'ADMINISTRADOR'
  );
$$;

-- ------------------------------------------------------------
-- PERFILES
-- Cada usuario ve y edita su propio perfil. Los administradores
-- pueden ver todos (necesario para el panel admin de suscriptores).
-- ------------------------------------------------------------
create policy "perfiles_select_propio" on public.perfiles
  for select using (auth.uid() = id or private.es_administrador());

create policy "perfiles_update_propio" on public.perfiles
  for update using (auth.uid() = id);

-- ------------------------------------------------------------
-- CURSOS, MÓDULOS, LECCIONES
-- SELECT abierto solo si el curso está publicado (mostrado = true).
-- INSERT/UPDATE/DELETE restringidos a ADMINISTRADOR.
-- ------------------------------------------------------------
create policy "cursos_select_publicos" on public.cursos
  for select using (mostrado = true or private.es_administrador());

create policy "cursos_admin_escritura" on public.cursos
  for all using (private.es_administrador())
  with check (private.es_administrador());

create policy "modulos_select_curso_publico" on public.modulos
  for select using (
    exists (
      select 1 from public.cursos
      where cursos.id = modulos.id_curso
        and (cursos.mostrado = true or private.es_administrador())
    )
  );

create policy "modulos_admin_escritura" on public.modulos
  for all using (private.es_administrador())
  with check (private.es_administrador());

create policy "lecciones_select_curso_publico" on public.lecciones
  for select using (
    exists (
      select 1 from public.modulos
      join public.cursos on cursos.id = modulos.id_curso
      where modulos.id = lecciones.id_modulo
        and (cursos.mostrado = true or private.es_administrador())
    )
  );

create policy "lecciones_admin_escritura" on public.lecciones
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- PROGRESO Y CERTIFICADOS
-- SELECT/INSERT/UPDATE limitados a auth.uid() = id_usuario.
-- ------------------------------------------------------------
create policy "progreso_propio" on public.progreso
  for all using (auth.uid() = id_usuario)
  with check (auth.uid() = id_usuario);

create policy "certificados_select_propio" on public.certificados
  for select using (auth.uid() = id_usuario or private.es_administrador());
