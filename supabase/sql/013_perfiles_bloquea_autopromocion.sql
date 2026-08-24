-- ============================================================
-- Cierra una escalada de privilegios en `perfiles`
-- Ver auditoría de RLS (checklist de seguridad, fase 6/7 del
-- development-plan.md).
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-012.
--
-- El problema: "perfiles_update_propio" (001_rls_policies.sql) solo
-- valida DE QUIÉN es la fila (auth.uid() = id), no QUÉ columnas se
-- pueden cambiar. RLS por sí sola no puede comparar el valor anterior
-- de una columna contra el nuevo dentro de una sola expresión de
-- policy, así que un estudiante autenticado podía llamar la API REST
-- de Supabase directamente y hacer:
--
--   PATCH /rest/v1/perfiles?id=eq.<su-propio-uuid>
--   { "rol": "ADMINISTRADOR" }   -- o { "estado": "ACTIVO" } estando suspendido
--
-- y RLS lo permitía, porque auth.uid() = id seguía siendo cierto.
-- GRANT/REVOKE a nivel de columna no sirve aquí: admins y estudiantes
-- comparten el mismo rol de Postgres (`authenticated`), así que
-- revocarle UPDATE de `rol`/`estado` a ese rol también se lo quitaría
-- al admin legítimo (perfiles_admin_escritura). La solución correcta
-- es un trigger BEFORE UPDATE, que sí puede comparar OLD vs NEW fila
-- por fila sin importar qué política de RLS se evaluó.
--
-- Verificado contra el código real: suspenderActivarUsuario()
-- (src/actions/admin/usuarios.ts) actualiza `perfiles.estado` con el
-- cliente de RLS del propio admin logueado (requireAdmin() ->
-- createClient()), nunca con la Service Role Key — así que
-- private.es_administrador() sigue evaluando auth.uid() del admin
-- real y el trigger no interfiere con ese flujo. Se agrega además un
-- bypass explícito para service_role, por si algún flujo futuro
-- (ej. un webhook) necesita tocar estas columnas desde el backend.
-- ============================================================

create or replace function private.perfiles_bloquea_autopromocion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.rol is distinct from old.rol or new.estado is distinct from old.estado)
     and not (private.es_administrador() or auth.role() = 'service_role') then
    raise exception 'No tienes permiso para cambiar el rol o el estado de la cuenta.'
      using errcode = '42501'; -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_bloquea_autopromocion on public.perfiles;
create trigger perfiles_bloquea_autopromocion
  before update on public.perfiles
  for each row execute function private.perfiles_bloquea_autopromocion();
