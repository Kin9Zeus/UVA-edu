-- ============================================================
-- Verificación pública de certificados por código
-- Ver auditoría de RLS (checklist de seguridad): "la verificación
-- pública se hace por una función específica, no abriendo la tabla".
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-014.
--
-- `certificados_select_propio` (001) solo deja ver un certificado a su
-- dueño o a un admin — correcto, porque la fila completa no debe ser
-- pública. Pero la landing de verificación pública (alguien pega el
-- código impreso en un certificado y confirma que es real) necesita
-- una vía que no pase por esa policy ni exponga la tabla completa.
--
-- A diferencia de check_email_provider (007) y
-- registrar_reenvio_verificacion (009), que se restringen a
-- service_role porque son parte de flujos internos de auth, esta
-- función SÍ debe ser invocable por `anon`: es justamente la manera
-- correcta de dar acceso público a un dato puntual sin volver pública
-- la tabla completa. Solo devuelve lo mínimo necesario para confirmar
-- validez (nombre del estudiante, curso, fecha) — nunca el id interno
-- del certificado ni el resto de columnas de `certificados`/`perfiles`.
--
-- Siempre devuelve exactamente una fila: si el código no existe,
-- `valido = false` y el resto de campos en null, para que el frontend
-- distinga "código inválido" de "error de red" sin depender de un
-- result set vacío.
--
-- Nota: esta definición queda reemplazada por
-- 020_actualiza_verificar_certificado_timestamptz.sql (cambia el tipo de
-- `fecha_emision`, que corre después en el orden de aplicación) y esa a
-- su vez por la actualización 2026-08-31 documentada ahí (lee el
-- snapshot congelado de `certificados` en vez de hacer JOIN en vivo
-- contra `perfiles`/`cursos`) — ver ese archivo para la versión
-- realmente vigente.
-- ============================================================

-- `create or replace function` no permite cambiar el tipo de retorno de una
-- función existente (solo el cuerpo); el drop la hace re-ejecutable de
-- forma segura si esta definición cambia más adelante.
drop function if exists public.verificar_certificado(text);

create or replace function public.verificar_certificado(p_codigo text)
returns table (
  valido boolean,
  nombre_estudiante text,
  nombre_curso text,
  fecha_emision timestamp
)
language plpgsql
security definer set search_path = public
stable
as $$
begin
  return query
    select
      true,
      perfiles.nombre,
      cursos.titulo,
      certificados.fecha_emision
    from public.certificados
    join public.perfiles on perfiles.id = certificados.id_usuario
    join public.cursos on cursos.id = certificados.id_curso
    where certificados.codigo_verificacion = p_codigo;

  if not found then
    return query select false, null::text, null::text, null::timestamp;
  end if;
end;
$$;

grant execute on function public.verificar_certificado(text) to anon, authenticated;
