-- ============================================================
-- Security Advisor: search_path mutable, extensiones en public,
-- y RPCs SECURITY DEFINER ejecutables por `anon`
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-057.
--
-- 1) private.generar_codigo_certificado (047) no tenía `set search_path`.
--    No es SECURITY DEFINER, así que no hay escalamiento de privilegios
--    posible, pero el linter lo marca igual porque un search_path mutable
--    permite que un objeto con el mismo nombre en un schema anterior del
--    search_path de quien llama sombree `extensions.gen_random_bytes` o
--    `substr`/`get_byte`. Se fija igual que el resto de las funciones del
--    proyecto.
--
-- 2) `unaccent` y `pg_trgm` (034) viven en `public` porque `create
--    extension if not exists unaccent;` sin `schema` las instala ahí por
--    default. Se mueven a `extensions` (el schema que Supabase ya usa para
--    pgcrypto, ver 047) — no hace falta togar 034: el índice
--    `cursos_titulo_trgm_idx`/`instructores_nombre_trgm_idx` y la función
--    `normalizar_busqueda` (que ya declara `set search_path = public,
--    extensions`) siguen resolviendo igual porque Postgres seguiría los
--    objetos movidos por OID, no por nombre.
--
-- 3) `cerrar_suscripcion_caducada_admin` (041), `crear_lote_codigos_invitacion`
--    (045) y `registrar_archivo_certificado` (048) son SECURITY DEFINER con
--    grant explícito a `authenticated`, pero ninguno revocó el EXECUTE que
--    Postgres otorga a PUBLIC por default al crear una función — por eso
--    el advisor también las marca ejecutables por `anon`. Las tres ya
--    verifican autorización adentro (private.es_administrador() las dos
--    primeras, `id_usuario = auth.uid()` la tercera), así que no hay bug de
--    seguridad, pero el acceso de `anon` no tiene ningún uso legítimo
--    (un cliente sin sesión no puede pasar esos chequeos) y sale sobrando.
--    Mismo criterio que ya usa canjear_codigo_invitacion (041): revocar de
--    PUBLIC y de `anon` explícitamente, dejando solo el grant necesario.
-- ============================================================

create or replace function private.generar_codigo_certificado()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 caracteres
  cuerpo   text := '';
  i        int;
begin
  for i in 1..10 loop
    cuerpo := cuerpo || substr(alfabeto, (get_byte(extensions.gen_random_bytes(1), 0) % 31) + 1, 1);
  end loop;
  return substr(cuerpo, 1, 5) || '-' || substr(cuerpo, 6, 5);
end;
$$;

alter extension unaccent set schema extensions;
alter extension pg_trgm set schema extensions;

revoke execute on function public.cerrar_suscripcion_caducada_admin(uuid) from public;
revoke execute on function public.cerrar_suscripcion_caducada_admin(uuid) from anon;
grant execute on function public.cerrar_suscripcion_caducada_admin(uuid) to authenticated;

revoke execute on function public.crear_lote_codigos_invitacion(text[], int, timestamptz) from public;
revoke execute on function public.crear_lote_codigos_invitacion(text[], int, timestamptz) from anon;
grant execute on function public.crear_lote_codigos_invitacion(text[], int, timestamptz) to authenticated;

revoke execute on function public.registrar_archivo_certificado(uuid, text) from public;
revoke execute on function public.registrar_archivo_certificado(uuid, text) from anon;
grant execute on function public.registrar_archivo_certificado(uuid, text) to authenticated;
