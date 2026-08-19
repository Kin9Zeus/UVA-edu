-- ============================================================
-- Row Level Security (RLS): Categorías y gestión de Perfiles por Admin
-- Ver docs/technical-spec.md §5 y prompt-panel-admin-claude-code.md.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000, 001, 002 y 003,
-- y después de aplicar la migración de Prisma que agrega
-- categorias.activo / categorias.id_admin_creador (ver prisma/migrations).
--
-- Cubre dos huecos que dejó 001_rls_policies.sql:
--   1. `categorias` tenía RLS activo pero CERO políticas (bloqueada por
--      completo salvo Service Role) — ni el catálogo público ni el
--      panel admin podían leerla.
--   2. `perfiles` solo tenía policy de UPDATE para el dueño de la fila
--      (auth.uid() = id); un administrador no podía suspender/activar
--      cuentas ni cambiar el rol de otro usuario desde el panel.
--
-- Mismo patrón que 002/003: cada `create policy` va precedido de un
-- `drop policy if exists` del mismo nombre.
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORIAS
-- Lectura pública solo de categorías activas (mismo criterio que
-- cursos.mostrado); el admin ve y gestiona todo.
-- ------------------------------------------------------------
drop policy if exists "categorias_select_publico" on public.categorias;
create policy "categorias_select_publico" on public.categorias
  for select using (activo = true or private.es_administrador());

drop policy if exists "categorias_admin_escritura" on public.categorias;
create policy "categorias_admin_escritura" on public.categorias
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- PERFILES
-- Permite al administrador actualizar cualquier perfil (suspender/
-- activar cuenta, cambiar rol al dar de alta a otro administrador —
-- ver docs/functional-spec.md Flujo 13). No se toca
-- "perfiles_update_propio": las políticas para la misma acción se
-- combinan con OR, así que el usuario sigue pudiendo editar su propio
-- nombre sin ser admin.
-- ------------------------------------------------------------
drop policy if exists "perfiles_admin_escritura" on public.perfiles;
create policy "perfiles_admin_escritura" on public.perfiles
  for update using (private.es_administrador())
  with check (private.es_administrador());
