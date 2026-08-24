-- ============================================================
-- Cierra el gap residual de invalidación de sesión al suspender una cuenta
-- Ver auditoría de RLS (checklist de seguridad) y
-- 013_perfiles_bloquea_autopromocion.sql.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-017.
--
-- El problema tenía dos capas y esta cierra la segunda:
--
--   1. suspenderActivarUsuario() (src/actions/admin/usuarios.ts) solo
--      actualizaba perfiles.estado; la sesión ya abierta del usuario
--      seguía siendo válida (JWT no expirado) hasta la próxima request
--      a una ruta protegida por proxy.ts, que recién ahí la corta. Esa
--      capa se cerró en código: suspenderActivarUsuario() ahora llama a
--      supabase.auth.admin.signOut(usuarioId, "global") con el cliente
--      de Service Role (createAdminClient(), src/lib/supabase/admin.ts)
--      justo después de marcar SUSPENDIDO, revocando todas las sesiones
--      activas del usuario en el servidor de Auth.
--
--   2. Pero admin.signOut("global") invalida las sesiones de Supabase
--      Auth — no el JWT en sí, que sigue siendo criptográficamente
--      válido hasta su expiración (access token de corta duración, pero
--      no inmediato). Un JWT ya emitido y no expirado usado DIRECTO
--      contra la API REST de Supabase (PostgREST), sin pasar por el
--      middleware de Next.js (proxy.ts) ni por el flujo normal de la
--      app, seguiría pasando cualquier policy que solo valide
--      auth.uid() = id_usuario. Esta capa cierra ese caso: agrega
--      private.cuenta_activa() (mismo patrón que
--      private.correo_verificado(), 008_correo_verificado_rls.sql) a
--      las policies de escritura que ya exigían correo verificado.
--
-- Las dos capas no son excluyentes, se complementan: signOut('global')
-- corta la sesión "normal" de inmediato (mejor UX, error claro en el
-- próximo request); cuenta_activa() en RLS cierra el hueco de un token
-- todavía válido usado fuera del flujo normal de la app, sin depender
-- de que el signOut se haya ejecutado con éxito.
--
-- A propósito NO se toca ningún SELECT: un usuario suspendido debe
-- poder seguir viendo su progreso histórico, certificados ya emitidos,
-- etc. — algo que ya pagó/tiene legítimamente. Solo se bloquea que
-- genere actividad nueva (autoinscribirse, registrar avance de video).
-- ============================================================

create or replace function private.cuenta_activa()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select estado = 'ACTIVO'
  from public.perfiles
  where id = auth.uid();
$$;

grant execute on function private.cuenta_activa() to anon, authenticated;

-- ------------------------------------------------------------
-- INSCRIPCIONES: sin cuenta activa no puede autoinscribirse a su
-- membresía. Reemplaza la policy de 008_correo_verificado_rls.sql
-- añadiendo la condición nueva con AND; el resto queda igual.
-- ------------------------------------------------------------
drop policy if exists "inscripciones_insert_propio" on public.inscripciones;
create policy "inscripciones_insert_propio" on public.inscripciones
  for insert with check (
    auth.uid() = id_usuario
    and tipo_acceso = 'MEMBRESIA'
    and otorgado_por is null
    and private.correo_verificado()
    and private.cuenta_activa()
    and exists (
      select 1 from public.suscripciones
      where suscripciones.id_usuario = auth.uid()
        and suscripciones.estado in ('ACTIVA', 'PAST_DUE')
    )
  );

-- ------------------------------------------------------------
-- PROGRESO: sin cuenta activa no puede registrar avance de
-- reproducción. Reemplaza progreso_insert_propio y
-- progreso_update_propio (014_separa_politicas_for_all.sql); no toca
-- progreso_select_propio ni progreso_delete_propio.
-- ------------------------------------------------------------
drop policy if exists "progreso_insert_propio" on public.progreso;
create policy "progreso_insert_propio" on public.progreso
  for insert with check (
    auth.uid() = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
  );

drop policy if exists "progreso_update_propio" on public.progreso;
create policy "progreso_update_propio" on public.progreso
  for update using (auth.uid() = id_usuario)
  with check (
    auth.uid() = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
  );
