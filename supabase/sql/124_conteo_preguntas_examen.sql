-- ============================================================
-- Cuántas preguntas tiene el examen final de un curso, por tipo.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-123.
-- Depende de 030 (private.tiene_acceso_vigente_curso) y 067 (examenes,
-- preguntas_examen).
--
-- Por qué
-- -------
-- La pantalla previa del examen (rediseño "examen") dice "10 preguntas" y
-- "Preguntas de elegir una respuesta y de relacionar parejas" antes de
-- empezar. El estudiante no puede leer `preguntas_examen`: sus políticas son
-- solo de administrador (067), a propósito — el enunciado y las opciones no
-- deben llegar al navegador antes de iniciar un intento, y las respuestas
-- correctas nunca.
--
-- Esta función devuelve SOLO cuántas hay de cada tipo, nada del contenido.
-- Es `security definer` para poder contar sin abrir la tabla, y repite las
-- dos condiciones que la página del examen ya exige para mostrarse: examen
-- publicado y acceso vigente al curso (o administrador). Sin ellas no
-- devuelve filas, igual que "no hay examen".
--
-- Idempotente: drop + create.
-- ============================================================

drop function if exists public.conteo_preguntas_examen(uuid);

create function public.conteo_preguntas_examen(p_id_curso uuid)
returns table (
  tipo text,
  total integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.tipo::text, count(*)::integer
  from public.examenes e
  join public.preguntas_examen p on p.id_examen = e.id
  where e.id_curso = p_id_curso
    and e.publicado
    and (private.tiene_acceso_vigente_curso(p_id_curso) or private.es_administrador())
  group by p.tipo;
$$;

revoke execute on function public.conteo_preguntas_examen(uuid) from public, anon;
grant execute on function public.conteo_preguntas_examen(uuid) to authenticated;
