-- ============================================================
-- El autoservicio (109) chocaba con el trigger anti-autopromoción (013).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-109.
--
-- El problema
-- -----------
-- perfiles_bloquea_autopromocion (013) exige `private.es_administrador() or
-- auth.role() = 'service_role'` para tocar `perfiles.rol`/`estado` — y hace
-- bien en exigirlo: es la defensa contra que un estudiante se
-- autopromueva a ADMINISTRADOR o se reactive de un SUSPENDIDO por su
-- cuenta. `auth.uid()`/`auth.role()` se resuelven por los claims del JWT
-- de la sesión real, no por el dueño de la función — así que aunque
-- `private.anonimizar_usuario()` sea SECURITY DEFINER, cuando la llama
-- `solicitar_supresion_propia()` (109) el trigger sigue viendo a un
-- ESTUDIANTE normal intentando poner su propia fila en `estado =
-- SUSPENDIDO`, y lo bloquea — con el mismo mensaje que bloquearía una
-- autopromoción real.
--
-- El flujo de administrador (075/104/108, vía public.anonimizar_usuario)
-- nunca chocó con esto porque ahí SÍ es un admin real quien llama, y
-- private.es_administrador() lo deja pasar.
--
-- La solución: el mismo GUC local a la transacción que 104 ya usa para
-- el mismo problema en curso_calificaciones_transiciones_permitidas — un
-- interruptor que SOLO private.anonimizar_usuario() enciende, y que el
-- trigger reconoce como autorización de que el cambio de estado viene de
-- una supresión ya autorizada río arriba (por public.anonimizar_usuario
-- o por public.solicitar_supresion_propia, cada uno con su propia
-- verificación de quién puede invocarlo), no de un intento de
-- autopromoción.
-- ============================================================

create or replace function private.perfiles_bloquea_autopromocion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.rol is distinct from old.rol or new.estado is distinct from old.estado)
     and not (
       private.es_administrador()
       or auth.role() = 'service_role'
       or coalesce(current_setting('uva.anonimizando', true), 'off') = 'on'
     ) then
    raise exception 'No tienes permiso para cambiar el rol o el estado de la cuenta.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- private.anonimizar_usuario() — mismo cuerpo que 108, con el GUC
-- encendido desde el principio (ya no solo alrededor de
-- curso_calificaciones) para cubrir también el UPDATE de `perfiles` de
-- más abajo, que es justo el que necesita el bypass del trigger de
-- arriba.
-- ------------------------------------------------------------
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

  -- Local a la transacción (tercer argumento de set_config = true): no
  -- sobrevive a la llamada ni contamina la conexión del pool. Encendido
  -- desde acá para cubrir TANTO el UPDATE de curso_calificaciones como el
  -- de perfiles más abajo — los dos triggers que necesitan reconocer que
  -- esta función ya autorizó el cambio río arriba.
  perform set_config('uva.anonimizando', 'on', true);

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

  -- Apagado explícito, aunque el `true` de set_config ya lo limite a esta
  -- transacción: si el llamador sigue haciendo cosas después (p. ej. la
  -- bitácora del flujo de admin), no debe arrastrar el permiso.
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
