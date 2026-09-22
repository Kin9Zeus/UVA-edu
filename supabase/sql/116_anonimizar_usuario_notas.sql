-- ============================================================
-- private.anonimizar_usuario() también borra las notas privadas del
-- estudiante (notas_leccion, 115).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-115.
--
-- Por qué hace falta
-- ------------------
-- Las notas son texto libre escrito por el estudiante: dato personal sin
-- ninguna razón para sobrevivir a la supresión de la cuenta. La FK
-- `notas_leccion.id_usuario -> perfiles` NO resuelve esto con una cascada,
-- porque la supresión ANONIMIZA la fila de `perfiles`, nunca la borra: un
-- ON DELETE CASCADE jamás se dispararía. El borrado tiene que ser explícito,
-- en el bloque "1. Lo que se borra", junto a progreso e intentos_examen.
--
-- Cuerpo copiado de 111 (la versión vigente, con el statement_timeout
-- local) + la única línea nueva, marcada "116". Si alguien vuelve a
-- redefinir esta función, debe partir de ESTE archivo, no de 111.
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
  -- Local a la transacción de esta llamada (tercer argumento = true): no
  -- persiste en la conexión del pool ni afecta ninguna otra query del rol
  -- `authenticated`.
  perform set_config('statement_timeout', '30000', true);

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

  perform set_config('uva.anonimizando', 'on', true);

  -- ---------------------------------------------------------
  -- 1. Lo que se borra
  -- ---------------------------------------------------------
  delete from public.comentario_likes where id_usuario = p_id_usuario;
  delete from public.progreso where id_usuario = p_id_usuario;
  delete from public.intentos_examen where id_usuario = p_id_usuario;
  -- 116: apuntes privados del estudiante (docs/notas-leccion.md §8). La FK
  -- a perfiles no los borra sola: la cuenta se anonimiza, no se elimina.
  delete from public.notas_leccion where id_usuario = p_id_usuario;
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

  update public.curso_calificaciones
     set comentario = null,
         eliminado = true,
         eliminado_por_admin = true,
         id_eliminado_por = (select auth.uid())
   where id_usuario = p_id_usuario
     and not (comentario is null and eliminado and eliminado_por_admin);

  -- ---------------------------------------------------------
  -- 3. El perfil
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

  perform set_config('uva.anonimizando', 'off', true);

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
