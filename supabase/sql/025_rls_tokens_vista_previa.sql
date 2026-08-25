-- ============================================================
-- RLS de tokens_vista_previa (enlaces temporales para revisar un curso en
-- borrador). Ver Revcurso, requisito 3, y la migración de Prisma
-- 20260825020000_tokens_vista_previa.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-024 y de
-- correr esa migración de Prisma.
--
-- Criterio: esta tabla es EXCLUSIVAMENTE de administradores. No hay ninguna
-- política para `anon` ni para estudiantes, ni siquiera de lectura.
--
-- Puede parecer contradictorio, porque justamente sirve para dar acceso a
-- alguien sin cuenta. No lo es: quien abre el enlace NUNCA consulta esta
-- tabla. Presenta un token, y la validación ocurre del lado del servidor de
-- Next.js (src/lib/vistaPrevia.ts), que compara su SHA-256 contra la
-- columna. El visitante no necesita —ni debe— poder leer nada de aquí:
-- listar esta tabla sería listar todos los enlaces activos de la
-- plataforma.
--
-- Escritura separada por operación (Bloque 2 de la auditoría de RLS: nada
-- de políticas `for all`). No hay política de DELETE a propósito: los
-- enlaces se revocan con `revocado_en`, no se borran, para conservar el
-- rastro de qué se compartió y cuándo.
-- ============================================================

alter table public.tokens_vista_previa enable row level security;

drop policy if exists "tokens_vista_previa_admin_select" on public.tokens_vista_previa;
create policy "tokens_vista_previa_admin_select" on public.tokens_vista_previa
  for select using (private.es_administrador());

drop policy if exists "tokens_vista_previa_admin_insert" on public.tokens_vista_previa;
create policy "tokens_vista_previa_admin_insert" on public.tokens_vista_previa
  for insert with check (private.es_administrador());

-- El UPDATE es el que revoca (marca `revocado_en`).
drop policy if exists "tokens_vista_previa_admin_update" on public.tokens_vista_previa;
create policy "tokens_vista_previa_admin_update" on public.tokens_vista_previa
  for update using (private.es_administrador())
  with check (private.es_administrador());
