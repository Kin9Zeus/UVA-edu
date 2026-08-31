-- ============================================================
-- Row Level Security (RLS): Lotes de códigos de invitación
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 016 y de
-- aplicar la migración de Prisma 20260831000000_lotes_codigos_invitacion.
--
-- Mismo criterio que `codigos_invitacion` (016): solo administradores, sin
-- policy de SELECT para anon/authenticated. La fila de un lote no expone
-- nada que un cliente deba poder leer directamente — el panel admin la lee
-- con la sesión del propio administrador, que sí cumple
-- private.es_administrador().
--
-- Sin policy de INSERT ni de UPDATE aquí a propósito: los lotes solo se
-- crean a través de public.crear_lote_codigos_invitacion() (045), que
-- corre como SECURITY DEFINER y por lo tanto no pasa por RLS. Dejar esta
-- tabla sin un camino de escritura por RLS impide que cualquier insert
-- directo (fuera del RPC) cree un lote sin sus códigos.
-- ============================================================

alter table public.lotes_codigos_invitacion enable row level security;

drop policy if exists "lotes_codigos_invitacion_admin_select" on public.lotes_codigos_invitacion;
create policy "lotes_codigos_invitacion_admin_select" on public.lotes_codigos_invitacion
  for select using (private.es_administrador());
