-- ============================================================
-- Row Level Security (RLS): Códigos de invitación
-- Ver auditoría de RLS y prisma/migrations/20260824000000_agrega_codigos_invitacion.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-015 y de aplicar
-- la migración de Prisma que crea `codigos_invitacion`.
--
-- Mismo criterio que `cupones` (003_rls_membresia_y_gestion.sql):
-- intencionalmente SIN policy de SELECT para anon/authenticated. Un
-- código expone plan, límite de usos y vencimiento — datos que no debe
-- poder listar/enumerar un cliente. El canje ("¿es válido este código?
-- si sí, dame acceso") lo resuelve un Server Action con Service Role
-- Key (mismo patrón que aplicar un cupón en checkout), nunca una query
-- directa del cliente contra esta tabla ni un INSERT directo en
-- `suscripciones`.
--
-- Escrita desde cero como 4 políticas separadas (no "for all"), a
-- diferencia de las tablas que 014_separa_politicas_for_all.sql tuvo
-- que corregir después.
-- ============================================================

alter table public.codigos_invitacion enable row level security;

drop policy if exists "codigos_invitacion_admin_select" on public.codigos_invitacion;
create policy "codigos_invitacion_admin_select" on public.codigos_invitacion
  for select using (private.es_administrador());

drop policy if exists "codigos_invitacion_admin_insert" on public.codigos_invitacion;
create policy "codigos_invitacion_admin_insert" on public.codigos_invitacion
  for insert with check (private.es_administrador());

drop policy if exists "codigos_invitacion_admin_update" on public.codigos_invitacion;
create policy "codigos_invitacion_admin_update" on public.codigos_invitacion
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "codigos_invitacion_admin_delete" on public.codigos_invitacion;
create policy "codigos_invitacion_admin_delete" on public.codigos_invitacion
  for delete using (private.es_administrador());
