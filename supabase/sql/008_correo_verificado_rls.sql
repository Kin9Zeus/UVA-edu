-- ============================================================
-- Verificación de correo obligatoria (Flujo 02, ampliación)
-- Ver docs/functional-spec.md Flujo 02 y docs/technical-spec.md §5.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-007.
--
-- Mientras auth.users.email_confirmed_at sea nulo, el estudiante no
-- puede autoinscribirse a una membresía ni registrar su progreso de
-- reproducción. Se agrega private.correo_verificado() como refuerzo
-- de RLS a las dos únicas escrituras de cliente que hoy representan
-- "iniciar suscripción" (inscripciones_insert_propio) y "reproducir
-- video" (progreso_propio) — checkout real y el reproductor todavía
-- no existen como rutas (ver TODO de Muro de Pago en
-- src/lib/supabase/proxy.ts), así que no hay más tablas que cubrir
-- todavía.
-- ============================================================

-- Igual que private.es_administrador() (001_rls_policies.sql): vive en
-- `private` para que PostgREST no la exponga como endpoint REST, pero las
-- políticas RLS (evaluadas con privilegios de anon/authenticated) sí
-- pueden invocarla gracias al GRANT USAGE ON SCHEMA private ya otorgado.
create or replace function private.correo_verificado()
returns boolean
language sql
security definer set search_path = auth
stable
as $$
  select email_confirmed_at is not null
  from auth.users
  where id = auth.uid();
$$;

grant execute on function private.correo_verificado() to anon, authenticated;

-- ------------------------------------------------------------
-- INSCRIPCIONES: sin correo verificado no puede autoinscribirse a su
-- membresía. Reemplaza la policy de 003_rls_membresia_y_gestion.sql
-- añadiendo la condición nueva; el resto queda igual.
-- ------------------------------------------------------------
drop policy if exists "inscripciones_insert_propio" on public.inscripciones;
create policy "inscripciones_insert_propio" on public.inscripciones
  for insert with check (
    auth.uid() = id_usuario
    and tipo_acceso = 'MEMBRESIA'
    and otorgado_por is null
    and private.correo_verificado()
    and exists (
      select 1 from public.suscripciones
      where suscripciones.id_usuario = auth.uid()
        and suscripciones.estado in ('ACTIVA', 'PAST_DUE')
    )
  );

-- ------------------------------------------------------------
-- PROGRESO: sin correo verificado no puede registrar avance de
-- reproducción. Solo se toca el with check (INSERT/UPDATE) — el using
-- (SELECT/UPDATE/DELETE) sigue igual, leer su propio progreso no
-- depende de la verificación. Reemplaza la policy de
-- 001_rls_policies.sql.
-- ------------------------------------------------------------
drop policy if exists "progreso_propio" on public.progreso;
create policy "progreso_propio" on public.progreso
  for all using (auth.uid() = id_usuario)
  with check (auth.uid() = id_usuario and private.correo_verificado());
