-- ============================================================
-- Comunidad: quita el requisito de actividad reciente, por el momento.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-083.
--
-- Decisión de negocio (conversación de diseño, sept. 2026): mientras la
-- comunidad no tenga masa crítica, exigir un certificado en los últimos 30
-- días (pasado el bootstrap) deja afuera a demasiada gente sin necesidad.
-- El gate queda reducido a "suscripción vigente O administrador", sin
-- ventana de tiempo — igual para todos, sin excepción, indefinidamente
-- hasta que se decida reintroducir un requisito de actividad.
--
-- Es reversible a propósito: `private.comunidad_activo_por_certificado`,
-- `private.comunidad_bootstrap_activo`, los wrappers públicos
-- `comunidad_fin_bootstrap`/`comunidad_bootstrap_activo` y la tabla
-- `configuracion_comunidad` (con su RLS) NO se tocan ni se borran, solo
-- quedan sin usar — reintroducir el requisito más adelante es volver a
-- escribir esta única función, no rediseñar nada.
-- ============================================================

create or replace function private.comunidad_tiene_acceso(p_id_usuario uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.perfiles
      where id = p_id_usuario and rol = 'ADMINISTRADOR'
    )
    or private.suscripcion_da_acceso(p_id_usuario);
$$;

revoke execute on function private.comunidad_tiene_acceso(uuid) from public;
grant execute on function private.comunidad_tiene_acceso(uuid) to authenticated;
