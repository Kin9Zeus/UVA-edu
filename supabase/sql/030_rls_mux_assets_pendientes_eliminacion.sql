-- ============================================================
-- RLS de mux_assets_pendientes_eliminacion (cola de assets de Mux por
-- borrar tras un reemplazo de video, ver prisma/migrations/
-- 20260826000000_cola_eliminacion_assets_mux).
--
-- Orden de aplicación (npm run db:rls lo respeta): sin dependencias de
-- scripts anteriores más allá de private.es_administrador() (002), puede
-- ir al final.
--
-- Solo SELECT para administradores (mismo criterio que bitacora_admin_select
-- en 014_separa_politicas_for_all.sql): es una tabla de auditoría/cola, no
-- algo que un admin cree o edite a mano. Los únicos escritores son
-- service_role — el webhook de Mux (src/app/api/webhooks/mux/route.ts) que
-- encola, y el futuro job de limpieza que marcará `eliminado` — y
-- service_role no pasa por RLS. Sin política de INSERT/UPDATE/DELETE, esas
-- operaciones quedan bloqueadas por defecto para cualquier otro rol.
-- ============================================================

alter table public.mux_assets_pendientes_eliminacion enable row level security;

drop policy if exists "mux_assets_pendientes_eliminacion_admin_select" on public.mux_assets_pendientes_eliminacion;
create policy "mux_assets_pendientes_eliminacion_admin_select" on public.mux_assets_pendientes_eliminacion
  for select using (private.es_administrador());
