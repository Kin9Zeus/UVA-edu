-- ============================================================
-- Intensidad y enlace al curso en `verificar_certificado`.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-122.
-- Reemplaza la definición de 020_actualiza_verificar_certificado_timestamptz.sql
-- y vuelve a dejar los permisos de 050 (solo service_role).
--
-- Por qué
-- -------
-- La página de verificación rediseñada (tableros "verificados" y
-- "verificado movil") muestra la intensidad del curso y un botón "Conocer el
-- curso". La función solo devolvía nombre, curso y fecha.
--
-- Intensidad: la misma regla que imprime el PDF (descargarCertificadoPdf y
-- lib/certificados/duracion.ts): suma de las clases con video LISTO del
-- curso. Así la página dice lo mismo que el certificado. Si da 0, la página
-- oculta la fila en vez de inventar una cifra.
--
-- Slug: solo si el curso sigue publicado (`mostrado`). Un curso retirado no
-- tiene ficha pública, y el botón llevaría a un 404. El certificado sigue
-- siendo válido igual: el nombre del curso viene del snapshot congelado.
--
-- Nunca expone correo, id del usuario ni id del curso.
--
-- Las columnas nuevas van AL FINAL del `returns table`. Cambia la firma de
-- salida, así que hay que soltar la función; al recrearla nace con EXECUTE
-- para PUBLIC, por eso se repiten aquí los revoke/grant de 050. Idempotente:
-- drop + create.
-- ============================================================

drop function if exists public.verificar_certificado(text);

create function public.verificar_certificado(p_codigo text)
returns table (
  valido boolean,
  nombre_estudiante text,
  nombre_curso text,
  fecha_emision timestamptz,
  duracion_total_segundos bigint,
  curso_slug text
)
language plpgsql
security definer set search_path = public
stable
as $$
begin
  return query
    select
      true,
      cert.nombre_estudiante,
      cert.nombre_curso,
      cert.fecha_emision,
      (
        select coalesce(sum(l.duracion), 0)::bigint
        from public.modulos m
        join public.lecciones l on l.id_modulo = m.id
        where m.id_curso = cert.id_curso
          and l.estado_procesamiento = 'LISTO'
      ),
      case when c.mostrado then c.slug else null end
    from public.certificados cert
    join public.cursos c on c.id = cert.id_curso
    where cert.codigo_verificacion = p_codigo;

  if not found then
    return query select false, null::text, null::text, null::timestamptz, null::bigint, null::text;
  end if;
end;
$$;

revoke execute on function public.verificar_certificado(text) from public, anon, authenticated;
grant execute on function public.verificar_certificado(text) to service_role;
