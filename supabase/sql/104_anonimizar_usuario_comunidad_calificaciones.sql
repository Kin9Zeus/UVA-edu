-- ============================================================
-- private.anonimizar_usuario() extiende la supresión a Comunidad y a las
-- reseñas de curso. Cierra AUDIT-2026-09-15.md — P1-2.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-103.
--
-- El problema
-- -----------
-- 075_anonimizar_usuario.sql no se tocó desde que se creó (antes del
-- 08-sep). Comunidad (083, comunidad_posts/comunidad_respuestas) y las
-- reseñas de curso (102, curso_calificaciones.comentario) se agregaron
-- después y nunca se sumaron a la función: hoy, anonimizar a alguien le
-- pone "Usuario eliminado" en `perfiles`, pero lo que esa persona escribió
-- en Comunidad o en una reseña sigue completo y visible — en la categoría
-- EMPLEO de Comunidad esto incluye `empleo_enlace`/`empleo_empresa`, datos
-- de contacto reales.
--
-- Por qué curso_calificaciones necesita una excepción y Comunidad no
-- ----------------------------------------------------------------
-- comunidad_posts_transiciones_permitidas / comunidad_respuestas_...
-- (083) ya permiten vaciar `contenido`/`titulo` en cualquier momento, sin
-- condición sobre `eliminado` — por eso ahí no hace falta tocar el trigger,
-- solo usarlo.
--
-- curso_calificaciones_transiciones_permitidas (102) es más estricta:
-- bloquea cualquier cambio a `puntuacion`/`comentario` en la MISMA
-- transacción en que `eliminado` pasa a true (columna `old.eliminado or
-- new.eliminado`, sin excepción para "vaciar"). Es correcto para el uso
-- normal —nadie debería poder reescribir el comentario de una reseña que
-- está borrando—, pero también le cierra la puerta a esta función. Se
-- reutiliza el mismo mecanismo que 074_endurece_exposicion.sql ya usa para
-- el mismo problema (`purgar_bitacora_de_admin`): un GUC local a la
-- transacción que el trigger reconoce y que solo esta función enciende.
-- ============================================================

create or replace function private.curso_calificaciones_transiciones_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Local a la transacción (tercer argumento de set_config = true): no
  -- sobrevive a la llamada ni contamina la conexión del pool. Solo
  -- private.anonimizar_usuario() lo enciende.
  if coalesce(current_setting('uva.anonimizando', true), 'off') = 'on' then
    return new;
  end if;

  if (
    new.puntuacion is distinct from old.puntuacion
    or new.comentario is distinct from old.comentario
  ) and (old.eliminado or new.eliminado or (select auth.uid()) <> old.id_usuario) then
    raise exception 'Una reseña solo la puede editar su propio autor, mientras no esté eliminada.'
      using errcode = 'check_violation';
  end if;

  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Una reseña eliminada solo puede restaurarla un administrador.'
      using errcode = 'check_violation';
  end if;

  if (
    new.eliminado_por_admin is distinct from old.eliminado_por_admin
    or new.id_eliminado_por is distinct from old.id_eliminado_por
  ) then
    if not private.es_administrador() then
      raise exception 'Marcar una reseña como moderada requiere un administrador.'
        using errcode = 'check_violation';
    end if;
    if new.eliminado_por_admin and not new.eliminado then
      raise exception 'Una reseña moderada por un admin debe quedar eliminada.'
        using errcode = 'check_violation';
    end if;
    if new.id_eliminado_por is distinct from (select auth.uid()) and new.id_eliminado_por is not null then
      raise exception 'Un administrador solo puede firmar la moderación con su propio id.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- private.anonimizar_usuario() — mismo cuerpo que 075, con tres bloques
-- nuevos entre "2. Lo que se conserva vacío" (comentarios) y "3. El
-- perfil": comunidad_posts, comunidad_respuestas y curso_calificaciones.
--
-- comunidad_adjuntos NO se toca aquí: borrar solo la fila dejaría el
-- archivo huérfano en Storage (esta función no puede llamar a la API de
-- Storage, solo a SQL). Se borra fila+archivo juntos desde TypeScript,
-- en anonimizarUsuario (src/actions/admin/usuarios.ts), reutilizando
-- borrarAdjuntoComunidad — el mismo helper que ya usa eliminar.ts —, antes
-- de invocar esta RPC.
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

  -- Idempotente: repetir la operación no debe fallar ni volver a escribir.
  -- Una segunda pasada sobre una cuenta ya anonimizada no tendría datos que
  -- borrar, pero sí movería `anonimizado_en` y falsearía la fecha real de la
  -- supresión, que es justo el dato que hay que poder demostrar.
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

  -- comunidad_posts_transiciones_permitidas (083) ya permite vaciar
  -- contenido/titulo sin condición sobre `eliminado`, así que este UPDATE
  -- no necesita ningún bypass. `eliminado_por_admin = true` porque quien
  -- deja el hilo así es esta función (invocada por un administrador), no
  -- el propio autor borrando su publicación.
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

  -- curso_calificaciones_transiciones_permitidas (102, redefinida arriba en
  -- este mismo archivo) sí bloquea vaciar `comentario` en la misma
  -- transacción en que `eliminado` pasa a true — de ahí el GUC. Se apaga
  -- explícitamente al terminar, aunque el `true` de set_config ya lo limite
  -- a esta transacción, por el mismo motivo que purgar_bitacora_de_admin
  -- (074): si el llamador sigue haciendo cosas después, no debe arrastrar
  -- el permiso. `puntuacion` se conserva: es solo un número 1-5, no
  -- identifica a nadie por sí solo; lo que hay que suprimir es el texto
  -- libre de `comentario`.
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
  -- ---------------------------------------------------------
  update public.perfiles
     set nombre         = 'Usuario eliminado',
         correo         = v_correo_anonimo,
         celular        = null,
         pais           = null,
         especialidad   = null,
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
