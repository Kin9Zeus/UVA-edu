-- ============================================================
-- Lo que una persona puede cambiar de su propio perfil (P1-2,
-- auditorias/AUDIT-2026-11-23.md).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-138.
--
-- El problema
-- -----------
-- `perfiles_update_propio` (077) deja actualizar la fila propia entera, y el
-- trigger anti-autopromoción (013/110) solo vigilaba `rol` y `estado`. Con la
-- llave pública y su sesión, cualquiera podía escribir directo por PostgREST,
-- sin pasar por las acciones:
--   · `correo` (UNIQUE): poner el de otra persona le impedía registrarse
--     (`handle_new_user` choca con el UNIQUE), y los correos de la app
--     (bienvenida del canje, aviso de moderación) salían a esa dirección.
--   · `foto_url`: una URL externa se pinta con <img> en comentarios y en el
--     detalle del admin → píxel de rastreo con la IP de quien la ve.
--   · `especialidad` (solo la edita el admin), `anonimizado_en`, `creado_en`.
--
-- La regla
-- --------
-- Quien no es admin, service_role ni una supresión en curso solo puede
-- cambiar lo que edita «Mi perfil» (src/actions/perfil/actualizar.ts y
-- foto.ts). Es una lista de lo PERMITIDO: una columna nueva queda protegida
-- sola.
--   · `slug` y `actualizado_en` están en la lista porque los ponen otros
--     triggers. `perfiles_asigna_slug` corre ANTES que este (orden
--     alfabético) y reescribe el slug cuando cambia el nombre; además ya
--     ignora cualquier slug escrito a mano (NEW.slug := OLD.slug).
--   · `foto_url` solo puede quedar en null o en la URL pública de la carpeta
--     propia del bucket `avatares` — exactamente lo que arma `getPublicUrl`
--     en foto.ts. El dominio sale del emisor del token de la sesión
--     (`iss` = https://<proyecto>.supabase.co/auth/v1): no basta con mirar la
--     ruta, porque https://evil.tld/storage/v1/object/public/avatares/<id>/x
--     la imitaría.
--
-- Mismo trigger, mismas excepciones que 110: las acciones del admin escriben
-- `rol`, `estado` y `especialidad` con su propia sesión (por eso no se usan
-- privilegios por columna), la supresión enciende `uva.anonimizando`, y los
-- scripts operativos fijan `request.jwt.claim.role = service_role`.
-- ============================================================

create or replace function private.perfiles_bloquea_autopromocion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_permitidas constant text[] := array[
    'nombre', 'celular', 'pais', 'rol_gremio', 'foto_url', 'slug', 'actualizado_en'
  ];
  v_prefijo_foto text;
  v_archivo text;
begin
  if private.es_administrador()
     or auth.role() = 'service_role'
     or coalesce(current_setting('uva.anonimizando', true), 'off') = 'on' then
    return new;
  end if;

  if new.rol is distinct from old.rol or new.estado is distinct from old.estado then
    raise exception 'No tienes permiso para cambiar el rol o el estado de la cuenta.'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - v_permitidas) is distinct from (to_jsonb(old) - v_permitidas) then
    raise exception 'No tienes permiso para cambiar ese dato de la cuenta.'
      using errcode = '42501';
  end if;

  if new.foto_url is distinct from old.foto_url and new.foto_url is not null then
    v_prefijo_foto := regexp_replace(coalesce(auth.jwt() ->> 'iss', ''), '/auth/v1/?$', '')
      || '/storage/v1/object/public/avatares/' || new.id::text || '/';
    v_archivo := substr(new.foto_url, length(v_prefijo_foto) + 1);

    if v_prefijo_foto not like 'https://%'
       or left(new.foto_url, length(v_prefijo_foto)) <> v_prefijo_foto
       or v_archivo = ''
       or v_archivo ~ '[/?#]' then
      raise exception 'La foto de perfil no es válida.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
