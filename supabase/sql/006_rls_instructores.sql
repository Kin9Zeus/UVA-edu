-- ============================================================
-- Row Level Security (RLS): Instructores
-- Ver docs/technical-spec.md §4 (tabla Instructores) y §5.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000–005, y después de
-- aplicar la migración de Prisma que crea la tabla `instructores`
-- (prisma/migrations/*_instructores_como_entidad).
--
-- Por qué hace falta el ENABLE explícito: `001_rls_policies.sql` activó RLS
-- sobre las 15 tablas que existían entonces. Una tabla creada después nace
-- SIN row level security, o sea legible y escribible por `anon` a través de
-- PostgREST. No es opcional.
--
-- Criterio, calcado de `categorias` en 005:
--   · SELECT público — el catálogo muestra quién dicta cada curso sin
--     necesidad de login, igual que muestra el título o la categoría. Un
--     instructor no tiene cuenta ni dato personal sensible aquí: es solo
--     nombre y especialidad.
--   · Escritura solo ADMINISTRADOR, vía private.es_administrador().
--
-- Sin filtro equivalente a `categorias.activo` porque el modelo no tiene
-- esa columna: un instructor o existe o no existe.
--
-- Idempotente: `drop policy if exists` antes de cada `create policy`,
-- mismo patrón que 002–005.
-- ============================================================

alter table public.instructores enable row level security;

drop policy if exists "instructores_select_publico" on public.instructores;
create policy "instructores_select_publico" on public.instructores
  for select using (true);

drop policy if exists "instructores_admin_escritura" on public.instructores;
create policy "instructores_admin_escritura" on public.instructores
  for all using (private.es_administrador())
  with check (private.es_administrador());
