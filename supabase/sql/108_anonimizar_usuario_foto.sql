-- ============================================================
-- private.anonimizar_usuario() también limpia perfiles.foto_url.
-- Hueco encontrado revisando P2-11 de AUDIT-2026-09-15.md.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-107.
--
-- El problema
-- -----------
-- 075_anonimizar_usuario.sql (y su redefinición en 104) vacían `nombre`,
-- `correo`, `celular`, `pais` y `especialidad`, pero nunca tocan `foto_url`:
-- la foto real de la persona sobrevivía a su propia supresión de datos,
-- mientras el nombre ya decía "Usuario eliminado". Es justo la reserva que
-- quedó anotada sin cerrar en el addendum de P1-2 (AUDIT-2026-09-15.md,
-- línea 241: "reserva de nombre/foto").
--
-- Por qué el archivo de Storage se borra desde TypeScript, no acá
-- -----------------------------------------------------------------
-- Mismo motivo que comunidad_adjuntos (104): esta función es SQL puro, no
-- puede llamar a la API de Storage. Borrar solo la fila (foto_url = null)
-- sin borrar el objeto dejaría el archivo huérfano en el bucket `avatares`
-- — ver `borrarFotoPerfil` (src/lib/perfil/avatar.ts), que ahora se llama
-- ANTES de esta RPC tanto desde el flujo de administrador
-- (src/actions/admin/usuarios.ts) como desde el de autoservicio
-- (src/actions/perfil/eliminar-cuenta.ts).
-- ============================================================

create or replace function private.anonimizar_usuario(p_id_usuario uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_correo_anonimo text;
  v_ya_anonimo     timestamptz;
begin
  if p_id_usuario is null then
    raise exception 'Falta el id del usuario a anonimizar.' using errcode = '22023';
  end if;

  select anonimizado_en into v_ya_anonimo
  from public.perfiles where id = p_id_usuario;

  if not found then
    raise exception 'No existe el perfil %.', p_id_usuario using errcode = '02000';
  end if;

  if v_ya_anonimo is not null then
    return;
  end if;

  v_correo_anonimo := 'anon+' || replace(p_id_usuario::text, '-', '') || '@uva.invalid';

  -- ---------------------------------------------------------
  -- 1. Lo que se borra
  -- ---------------------------------------------------------
  delete from public.comentario_likes where id_usuario = p_id_usuario;
  delete from public.progreso where id_usuario = p_id_usuario;
  delete from public.intentos_examen where id_usuario = p_id_usuario;
  delete from public.curso_instructores where id_instructor = p_id_usuario;

  -- ---------------------------------------------------------
  -- 2. Lo que se conserva vacío
  -- ---------------------------------------------------------
  update public.comentarios
     set contenido = '',
         eliminado = true
   where id_usuario = p_id_usuario
     and not (contenido = '' and eliminado);

  update public.comunidad_posts
     set contenido = '',
         titulo = '',
         eliminado = true,
         eliminado_por_admin = true
   where id_usuario = p_id_usuario
     and not (contenido = '' and titulo = '' and eliminado and eliminado_por_admin);

  update public.comunidad_respuestas
     set contenido = '',
         eliminado = true,
         eliminado_por_admin = true
   where id_usuario = p_id_usuario
     and not (contenido = '' and eliminado and eliminado_por_admin);

  perform set_config('uva.anonimizando', 'on', true);
  update public.curso_calificaciones
     set comentario = null,
         eliminado = true,
         eliminado_por_admin = true,
         id_eliminado_por = (select auth.uid())
   where id_usuario = p_id_usuario
     and not (comentario is null and eliminado and eliminado_por_admin);
  perform set_config('uva.anonimizando', 'off', true);

  -- ---------------------------------------------------------
  -- 3. El perfil
  --
  -- `foto_url` se limpia ACÁ (nuevo en esta migración) — el archivo en
  -- Storage ya se borró antes de llamar a esta función, así que esto solo
  -- desconecta la referencia. Sin esto, la UI seguiría mostrando una foto
  -- de un perfil que ya dice "Usuario eliminado".
  -- ---------------------------------------------------------
  update public.perfiles
     set nombre         = 'Usuario eliminado',
         correo         = v_correo_anonimo,
         celular        = null,
         pais           = null,
         especialidad   = null,
         foto_url       = null,
         estado         = 'SUSPENDIDO',
         anonimizado_en = now()
   where id = p_id_usuario;

  -- ---------------------------------------------------------
  -- 4. La identidad en auth
  -- ---------------------------------------------------------
  delete from auth.identities where user_id = p_id_usuario;
  delete from auth.sessions where user_id = p_id_usuario;

  update auth.users
     set email               = v_correo_anonimo,
         phone               = null,
         raw_user_meta_data  = '{}'::jsonb,
         encrypted_password  = null,
         email_change        = '',
         phone_change        = '',
         banned_until        = now() + interval '100 years'
   where id = p_id_usuario;
end;
$$;

revoke execute on function private.anonimizar_usuario(uuid) from public, anon, authenticated;
