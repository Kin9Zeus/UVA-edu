-- ============================================================
-- Supresión de datos personales (Ley 1581 / Habeas Data)
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-4 (P1).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-074.
-- requiere-migracion: 20260908000000_anonimizacion_de_cuentas
-- REQUIERE la migración de Prisma 20260908000000_anonimizacion_de_cuentas
-- (columna perfiles.anonimizado_en). Si no está aplicada, este script falla
-- con «column "anonimizado_en" does not exist» — y como apply-rls.ts mete
-- todo en una transacción, no deja nada a medias.
--
-- El problema
-- -----------
-- `docs/legal/contenido-soporte.md:364` promete al titular el derecho a
-- "solicitar la supresión de tus datos". La base lo hacía imposible: diez
-- tablas referencian `perfiles` con ON DELETE RESTRICT, y basta una fila en
-- `suscripciones` para que la cuenta sea indeleble. En el momento de la
-- auditoría, 8 de 9 usuarios no se podían borrar. No existía ninguna ruta de
-- código que siquiera lo intentara.
--
-- Por qué no es un DELETE
-- -----------------------
-- Los RESTRICT no son un descuido: `pagos` y `certificados` tienen valor
-- contable y probatorio que sobrevive legítimamente a la cuenta, y
-- `bitacora_administrativa` es el registro de auditoría. La supresión
-- correcta es ANONIMIZAR: que no quede ningún dato del titular, conservando
-- las filas que la ley y la contabilidad exigen conservar.
--
-- Por qué auth.users se limpia en vez de borrarse
-- -----------------------------------------------
-- Este es el detalle que decide el diseño entero, y es fácil no verlo:
--
--   perfiles_id_fkey: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
--
-- Un `deleteUser` cascadearía al borrado de `perfiles`, que chocaría contra
-- el primer RESTRICT y abortaría la transacción entera. Es decir: mientras
-- el perfil deba sobrevivir —y debe— la fila de `auth.users` NO se puede
-- borrar. La alternativa no es dejarla intacta: se le quitan todos los datos
-- personales, se le destruye la credencial y se la inhabilita para siempre.
-- El resultado observable es el mismo que un borrado (no queda dato del
-- titular, la cuenta no se puede usar) sin romper la integridad referencial.
--
-- Qué se hace con cada tabla
-- --------------------------
--   perfiles              anonimiza (nombre, correo, celular, pais, especialidad)
--   auth.users            limpia correo/teléfono/metadatos, borra la contraseña, banea
--   auth.identities       borra (identity_data trae correo y nombre del proveedor OAuth)
--   comentarios           conserva la fila, vacía el contenido, marca eliminado
--   comentario_likes      borra (preferencia personal, sin valor para nadie más)
--   progreso              borra (sin valor probatorio)
--   intentos_examen       borra (incluye respuestas, que son datos del titular)
--   curso_instructores    borra (un curso no debe acreditar a "Usuario eliminado")
--   certificados          CONSERVA — nombre_estudiante ya es un snapshot congelado,
--                         justo lo que un certificado necesita para seguir
--                         siendo verificable por un tercero
--   inscripciones         CONSERVA — registro de qué acceso se otorgó
--   suscripciones, pagos  CONSERVA — obligación contable
--   bitacora_administrativa CONSERVA — registro de auditoría
--
-- Alcance de esta migración
-- -------------------------
-- Deja la CAPACIDAD técnica y una acción de administrador que la usa. El
-- botón de autoservicio para que el titular la dispare por su cuenta —lo
-- ideal— es trabajo aparte: hoy la política de privacidad dirige la
-- solicitud a un correo de soporte, y con esto esa solicitud por fin se
-- puede atender.
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

  -- Idempotente: repetir la operación no debe fallar ni volver a escribir.
  -- Una segunda pasada sobre una cuenta ya anonimizada no tendría datos que
  -- borrar, pero sí movería `anonimizado_en` y falsearía la fecha real de la
  -- supresión, que es justo el dato que hay que poder demostrar.
  if v_ya_anonimo is not null then
    return;
  end if;

  -- El propio id como semilla del correo. No hace falta un hash: el id ya
  -- está presente en todas las filas que se conservan (certificados, pagos,
  -- bitácora), así que derivarlo de ahí no revela nada nuevo — y garantiza
  -- unicidad sin colisiones, que es lo que exigen los UNIQUE de
  -- perfiles.correo y auth.users.email. `.invalid` es el TLD reservado por
  -- el RFC 2606 para nombres que nunca deben resolver.
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
  --
  -- El trigger comentarios_contenido_solo_se_vacia (064) permite
  -- exactamente esto —vaciar, nunca reescribir— así que no hay que
  -- desactivarlo. Se conserva la fila para no romper los hilos: borrar el
  -- comentario padre de una conversación cascadearía a las respuestas de
  -- otras personas, que no pidieron nada.
  -- ---------------------------------------------------------
  update public.comentarios
     set contenido = '',
         eliminado = true
   where id_usuario = p_id_usuario
     and not (contenido = '' and eliminado);

  -- ---------------------------------------------------------
  -- 3. El perfil
  --
  -- `estado = SUSPENDIDO` cierra el acceso por la vía que ya existe
  -- (private.cuenta_activa() en las policies de escritura, 019). `rol` NO se
  -- toca: si la cuenta era ADMINISTRADOR, su rol es parte de la lectura
  -- correcta de las entradas que dejó en la bitácora.
  --
  -- El trigger perfiles_bloquea_autopromocion (013) permite este cambio de
  -- estado porque el llamador es admin o service_role; esta función no lo
  -- puentea.
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
  --
  -- `identities.identity_data` es un jsonb con el correo, el nombre y la
  -- foto tal como los envió Google en el OAuth: es el sitio donde más datos
  -- personales quedan, y el que más se olvida. Borrarlas también desconecta
  -- el "iniciar sesión con Google".
  --
  -- Las sesiones se borran acá y no vía auth.admin.signOut() para que caigan
  -- dentro de la MISMA transacción que el resto: si algo falla más abajo, no
  -- queremos haber cerrado la sesión de alguien cuya supresión se revirtió.
  -- refresh_tokens cascadea desde sessions.
  -- ---------------------------------------------------------
  delete from auth.identities where user_id = p_id_usuario;
  delete from auth.sessions where user_id = p_id_usuario;

  update auth.users
     set email               = v_correo_anonimo,
         phone               = null,
         raw_user_meta_data  = '{}'::jsonb,
         encrypted_password  = null,
         -- A '' y no a null: son columnas que GoTrue mantiene con cadena
         -- vacía cuando no hay cambio pendiente, y ponerlas en null es
         -- salirse de la forma que su propio código espera. Se limpian
         -- porque un cambio de correo a medias guarda la dirección nueva,
         -- que también es un dato del titular.
         email_change        = '',
         phone_change        = '',
         -- Baneo permanente en la práctica.
         --
         -- NO usar 'infinity'::timestamptz aunque sea la representación
         -- semánticamente correcta de "para siempre": el servicio de Auth
         -- (GoTrue) está escrito en Go, y `time.Time` no tiene una
         -- representación de infinito. Deserializar esa fila revienta con
         -- «Database error loading user» — no solo en `deleteUser`, en
         -- CUALQUIER llamada admin sobre ese usuario, `getUserById`
         -- incluido. Se descubrió corriendo esta migración contra la base
         -- real: el usuario de prueba de scripts/rls-test.ts quedó
         -- inaccesible desde el panel de Auth y tuvo que limpiarse a mano.
         --
         -- 100 años es "para siempre" en cualquier sentido práctico y es un
         -- timestamptz corriente, sin el valor especial.
         banned_until        = now() + interval '100 years'
   where id = p_id_usuario;
end;
$$;

-- Solo la llama la Server Action de administración, con el cliente de
-- service role. Ni `anon` ni `authenticated` la ven.
revoke execute on function private.anonimizar_usuario(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Envoltorio en `public` para poder invocarla como RPC desde supabase-js
-- (PostgREST solo expone `public`). Repite la comprobación de rol en vez de
-- confiar en el GRANT: mismo criterio que 041 y 045.
--
-- Se exige service_role O administrador. Un administrador no puede
-- anonimizarse a sí mismo: perdería el acceso con el que está operando y
-- dejaría la plataforma potencialmente sin ningún administrador, que es un
-- estado del que no hay vuelta desde la interfaz.
-- ------------------------------------------------------------
create or replace function public.anonimizar_usuario(p_id_usuario uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not (private.es_administrador() or auth.role() = 'service_role') then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;

  if p_id_usuario = auth.uid() then
    raise exception 'Un administrador no puede anonimizar su propia cuenta.' using errcode = '42501';
  end if;

  perform private.anonimizar_usuario(p_id_usuario);
end;
$$;

revoke execute on function public.anonimizar_usuario(uuid) from public, anon;
grant execute on function public.anonimizar_usuario(uuid) to authenticated, service_role;
