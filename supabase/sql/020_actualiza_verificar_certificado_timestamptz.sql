-- ============================================================
-- Ajusta verificar_certificado() al nuevo tipo de fecha_emision
-- Ver 015_verificar_certificado_publico.sql y Bloque 1 de la
-- auditoría de esquema (prisma/migrations/20260824010000_estandariza_timestamps).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-019 y de
-- correr esa migración de Prisma. `certificados.fecha_emision` pasó
-- de timestamp a timestamptz; el tipo de retorno de esta función debe
-- coincidir exactamente o falla en tiempo de ejecución con "structure
-- of query does not match function result type" (ya nos pasó una vez
-- con el mismatch inverso, ver README).
-- ============================================================

drop function if exists public.verificar_certificado(text);

create or replace function public.verificar_certificado(p_codigo text)
returns table (
  valido boolean,
  nombre_estudiante text,
  nombre_curso text,
  fecha_emision timestamptz
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
    return query select false, null::text, null::text, null::timestamptz;
  end if;
end;
$$;

grant execute on function public.verificar_certificado(text) to anon, authenticated;
