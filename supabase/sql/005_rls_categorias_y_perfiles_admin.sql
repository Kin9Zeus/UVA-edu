-- ============================================================
-- Row Level Security (RLS): Categorías y gestión de Perfiles por Admin
-- Ver docs/technical-spec.md §5 y prompt-panel-admin-claude-code.md.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000, 001, 002, 003 y
-- 004_categorias_select_publico.sql, y después de aplicar la migración de
-- Prisma que agrega categorias.activo / categorias.id_admin_creador (ver
-- prisma/migrations).
--
-- Cubre dos cosas:
--   1. SUPERSEDE la policy "categorias_select_publico" que crea
--      004_categorias_select_publico.sql. Ese archivo se escribió antes de
--      que existiera la columna `categorias.activo` (la trae el panel
--      admin), así que dejaba la lectura pública sin ningún filtro
--      (`using (true)`). Aquí se recrea la misma policy — mismo nombre,
--      `drop policy if exists` antes del `create` — para que una
--      categoría desactivada por un admin deje de listarse en el
--      catálogo público, igual que ya hacen `cursos.mostrado` y
--      `planes.activo`. El admin sigue viendo todas (activas e
--      inactivas) vía el `or private.es_administrador()`.
--   2. `perfiles` solo tenía policy de UPDATE para el dueño de la fila
--      (auth.uid() = id); un administrador no podía suspender/activar
--      cuentas ni cambiar el rol de otro usuario desde el panel.
--
-- Mismo patrón que 002/003/004: cada `create policy` va precedido de un
-- `drop policy if exists` del mismo nombre.
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORIAS
-- Lectura pública solo de categorías activas (mismo criterio que
-- cursos.mostrado); el admin ve y gestiona todo. Reemplaza la policy
-- "using (true)" de 004_categorias_select_publico.sql (ver nota arriba).
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
