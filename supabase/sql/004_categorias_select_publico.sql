-- ============================================================
-- Lectura pública de categorías ("escuelas")
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000, 001, 002 y 003.
--
-- Por qué existe este archivo:
-- `001_rls_policies.sql` activa RLS sobre `public.categorias` pero nunca le
-- crea una política, así que la tabla quedaba bloqueada por completo para
-- `anon` y `authenticated` (solo alcanzable con Service Role). El README de
-- esta carpeta lo documenta como una decisión deliberada: no inventar reglas
-- que el spec todavía no definía.
--
-- Ahora sí hace falta: el Home lista las escuelas del catálogo sin login
-- (sección "Escuelas" del footer), leyendo `categorias` con la anon key
-- desde un Server Component. Sin política, esa consulta devuelve `[]` — no
-- da error, simplemente RLS filtra todas las filas, que es el modo de fallo
-- más difícil de diagnosticar.
--
-- La regla es la misma que ya tienen `planes` y `cursos`: una categoría es
-- metadato público del catálogo (nombre + descripción, sin dato sensible ni
-- de negocio), equivalente a `planes_select_publico` en 003. No se agrega
-- política de escritura porque el CMS de categorías es Fase 4 del
-- development-plan.md; hasta entonces `categorias` sigue sin INSERT/UPDATE/
-- DELETE para cliente (solo Service Role / Prisma).
--
-- Idempotente: `drop policy if exists` antes del `create policy`, mismo
-- patrón que 002 y 003.
-- ============================================================

drop policy if exists "categorias_select_publico" on public.categorias;
create policy "categorias_select_publico" on public.categorias
  for select using (true);
