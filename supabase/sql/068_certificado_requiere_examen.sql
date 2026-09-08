-- ============================================================
-- La certificación pasa a exigir examen aprobado (Flujo 07 — Revf5)
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-067.
--
-- Qué cambia
-- ----------
-- Hasta 047 un curso quedaba certificado con una sola condición: el 100% de
-- las lecciones LISTO marcadas como completadas. Ahora son dos:
--
--   1. 100% de lecciones LISTO completadas   (sin cambios)
--   2. si el curso tiene examen PUBLICADO, un intento en estado APROBADO
--
-- La condición 2 es condicional a propósito: un curso sin examen publicado
-- certifica exactamente como antes. Quien crea el curso decide si el suyo
-- necesita examen — no hay que migrar los cursos existentes ni cambiarles el
-- comportamiento (ver el comentario del modelo `Examenes` en schema.prisma).
--
-- Por qué hacen falta DOS triggers
-- --------------------------------
-- La condición se puede completar por cualquiera de sus dos lados, y en
-- cualquier orden:
--   · el estudiante aprueba el examen y después termina la última lección
--     -> lo detecta el trigger sobre `progreso` (el de 047, ya existente)
--   · el estudiante termina todas las lecciones y después aprueba el examen
--     -> no lo detectaba NADIE: `progreso` no se vuelve a tocar al aprobar un
--        examen, así que sin el trigger nuevo sobre `intentos_examen` el
--        certificado no se emitiría nunca. Este es el camino normal, además,
--        porque el examen solo se desbloquea al 100% de lecciones.
--
-- Los dos llaman a la misma función `private.emitir_certificado`, que ahora
-- recibe (usuario, curso) en vez de deducir el curso de una lección. Toda la
-- lógica de emisión —snapshot congelado, código de verificación, reintento
-- ante colisión— queda en un solo sitio; los triggers solo traducen su fila a
-- ese par de ids.
-- ============================================================

-- --------------------------------------------------------------
-- ¿Este estudiante terminó TODAS las lecciones del curso?
--
-- Primera de las dos condiciones, aislada porque la app también la necesita
-- por separado: el examen se desbloquea con el 100% de lecciones, así que la
-- pantalla del examen tiene que poder preguntar exactamente esto, sin que
-- "todavía no aprobó el examen" cuente como "le faltan lecciones".
--
-- El criterio es el mismo de 047 y de la vista progreso_cursos_estudiante
-- (033/062): solo cuentan las lecciones con video LISTO. Una lección
-- SUBIENDO/PROCESANDO/ERROR no es completable por el estudiante, así que no
-- puede bloquear la emisión ni, al revés, dar por completo un curso al que le
-- falta contenido por publicar.
--
-- Un curso sin ninguna lección publicada devuelve false: no se completa por
-- vacuidad.
-- --------------------------------------------------------------
create or replace function private.lecciones_completas_curso(p_id_usuario uuid, p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (
      select count(*) filter (where l.estado_procesamiento = 'LISTO') > 0
         and count(*) filter (where l.estado_procesamiento = 'LISTO') =
             count(*) filter (
               where l.estado_procesamiento = 'LISTO'
                 and exists (
                   select 1 from public.progreso p
                   where p.id_leccion = l.id
                     and p.id_usuario = p_id_usuario
                     and p.completado
                 )
             )
      from public.lecciones l
      join public.modulos m on m.id = l.id_modulo
      where m.id_curso = p_id_curso
    ),
    false
  );
$$;

revoke execute on function private.lecciones_completas_curso(uuid, uuid) from public;
grant execute on function private.lecciones_completas_curso(uuid, uuid) to authenticated;

-- --------------------------------------------------------------
-- ¿Este estudiante completó este curso? Fuente de verdad ÚNICA de la regla de
-- certificación (Revf5). La usan el trigger de emisión y —a través del
-- wrapper público de más abajo— la app, para no reimplementar la misma regla
-- en TypeScript y arriesgarse a que las dos versiones se separen.
-- --------------------------------------------------------------
create or replace function private.curso_esta_completo(p_id_usuario uuid, p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select private.lecciones_completas_curso(p_id_usuario, p_id_curso)
     and (
       -- Segunda condición, solo si el curso exige examen. Si no lo exige, la
       -- regla queda idéntica a la de antes de esta migración.
       not private.curso_exige_examen(p_id_curso)
       or private.aprobo_examen_curso(p_id_usuario, p_id_curso)
     );
$$;

revoke execute on function private.curso_esta_completo(uuid, uuid) from public;
grant execute on function private.curso_esta_completo(uuid, uuid) to authenticated;

-- --------------------------------------------------------------
-- Wrappers públicos para la app (PostgREST solo expone `public`).
--
-- Sin parámetro de usuario: siempre responden por `auth.uid()`. Que el
-- llamador no pueda elegir de quién pregunta es lo que hace que sean seguras
-- de exponer a `authenticated` — no hay forma de usarlas para enumerar el
-- avance de otro estudiante.
--
-- `lecciones_completas_curso` es la que consulta la pantalla del examen para
-- saber si desbloquearlo; `curso_esta_completo`, la que responde "¿este curso
-- ya cuenta como terminado?" sin duplicar la regla en la app.
-- --------------------------------------------------------------
create or replace function public.lecciones_completas_curso(p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select private.lecciones_completas_curso((select auth.uid()), p_id_curso);
$$;

revoke execute on function public.lecciones_completas_curso(uuid) from public;
grant execute on function public.lecciones_completas_curso(uuid) to authenticated;

create or replace function public.curso_esta_completo(p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select private.curso_esta_completo((select auth.uid()), p_id_curso);
$$;

revoke execute on function public.curso_esta_completo(uuid) from public;
grant execute on function public.curso_esta_completo(uuid) to authenticated;

-- --------------------------------------------------------------
-- Emisión propiamente dicha. Es el cuerpo que vivía dentro del trigger de
-- 047, movido tal cual (snapshot congelado incluido) y parametrizado por
-- (usuario, curso) para poder invocarlo desde los dos caminos.
--
-- SECURITY DEFINER sigue siendo obligatorio, no una preferencia de estilo:
-- corre en el contexto de quien disparó el trigger —la sesión del estudiante
-- en el camino de `progreso`— que solo tiene SELECT sobre `certificados`. Sin
-- esto, el INSERT violaría RLS y reventaría el guardado de progreso del
-- estudiante con un error ajeno a lo que estaba haciendo.
-- --------------------------------------------------------------
create or replace function private.emitir_certificado(p_id_usuario uuid, p_id_curso uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_codigo            text;
  v_intentos          int := 0;
  v_nombre_estudiante text;
  v_nombre_curso      text;
begin
  if p_id_curso is null or p_id_usuario is null then
    return;
  end if;

  -- Ya tiene certificado de este curso: el unique (id_usuario, id_curso) es
  -- la fuente de verdad de "ya emitido", esto solo evita el trabajo de
  -- evaluar la regla completa en el camino común (progreso que se sigue
  -- actualizando en un curso ya certificado).
  if exists (
    select 1 from public.certificados
    where id_usuario = p_id_usuario and id_curso = p_id_curso
  ) then
    return;
  end if;

  if not private.curso_esta_completo(p_id_usuario, p_id_curso) then
    return;
  end if;

  -- Snapshot congelado (Deteccion.md — Fase 5): el nombre del estudiante y el
  -- título del curso se leen una sola vez, acá, en el momento exacto de la
  -- emisión. Ni verificar_certificado() (015) ni la generación del PDF vuelven
  -- a leer perfiles.nombre/cursos.titulo — un cambio de nombre o un renombre
  -- del curso posterior no altera un certificado ya expedido.
  select nombre into v_nombre_estudiante from public.perfiles where id = p_id_usuario;
  select titulo into v_nombre_curso from public.cursos where id = p_id_curso;

  -- Reintenta solo si choca el código (23505 en codigo_verificacion, ~1 en
  -- 31^10). Si el choque es por (id_usuario, id_curso) es una carrera legítima
  -- —dos escrituras del mismo estudiante llegando a la vez— y sale sin error:
  -- el otro insert ya hizo el trabajo.
  loop
    v_intentos := v_intentos + 1;
    v_codigo := private.generar_codigo_certificado();
    begin
      insert into public.certificados
        (id_usuario, id_curso, codigo_verificacion, nombre_estudiante, nombre_curso)
      values
        (p_id_usuario, p_id_curso, v_codigo, v_nombre_estudiante, v_nombre_curso);
      exit;
    exception when unique_violation then
      if exists (
        select 1 from public.certificados
        where id_usuario = p_id_usuario and id_curso = p_id_curso
      ) then
        exit;
      end if;
      if v_intentos >= 5 then
        raise exception 'No se pudo generar un código de certificado único tras % intentos', v_intentos;
      end if;
    end;
  end loop;
end;
$$;

-- --------------------------------------------------------------
-- Camino 1: se completó una lección. Reemplaza el cuerpo de la función de
-- 047 — ahora solo traduce la lección a su curso y delega.
-- --------------------------------------------------------------
create or replace function private.emitir_certificado_si_completo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_curso uuid;
begin
  select m.id_curso into v_id_curso
  from public.lecciones l
  join public.modulos m on m.id = l.id_modulo
  where l.id = new.id_leccion;

  -- Lección huérfana (no debería pasar, FK mediante): nada que emitir.
  if v_id_curso is null then
    return new;
  end if;

  perform private.emitir_certificado(new.id_usuario, v_id_curso);
  return new;
end;
$$;

-- El trigger de 047 se recrea igual (la función cambió de cuerpo, no de
-- firma); se repite acá para que este archivo sea autocontenido y para que
-- reaplicar el lote deje el trigger apuntando a la versión nueva.
drop trigger if exists progreso_emite_certificado on public.progreso;
create trigger progreso_emite_certificado
  after insert or update of completado on public.progreso
  for each row
  when (new.completado = true)
  execute function private.emitir_certificado_si_completo();

-- --------------------------------------------------------------
-- Camino 2: se aprobó el examen (el habitual, porque el examen solo se
-- desbloquea con el 100% de lecciones ya completado).
--
-- `after insert or update of estado` aunque la app siempre inserte EN_CURSO y
-- después actualice: un intento insertado ya en APROBADO (una corrección
-- manual futura, una carga de datos) debe emitir igual. El `when` filtra en
-- el motor, así que los autoguardados de respuestas —que no tocan `estado`—
-- ni siquiera invocan la función.
-- --------------------------------------------------------------
create or replace function private.emitir_certificado_si_aprobo_examen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_curso uuid;
begin
  select id_curso into v_id_curso from public.examenes where id = new.id_examen;

  if v_id_curso is null then
    return new;
  end if;

  perform private.emitir_certificado(new.id_usuario, v_id_curso);
  return new;
end;
$$;

drop trigger if exists intento_examen_emite_certificado on public.intentos_examen;
create trigger intento_examen_emite_certificado
  after insert or update of estado on public.intentos_examen
  for each row
  when (new.estado = 'APROBADO')
  execute function private.emitir_certificado_si_aprobo_examen();

-- --------------------------------------------------------------
-- progreso_cursos_estudiante: dos columnas nuevas para que el dashboard
-- pueda distinguir tres estados en vez de dos.
--
--   examen_requerido = false                  -> "Completo" con el 100% de
--                                                lecciones, como siempre
--   examen_requerido = true,  aprobado = false -> "Examen pendiente"
--   examen_requerido = true,  aprobado = true  -> "Completo"
--
-- Sin esto, ProgresoContent seguiría pintando "Completado" con
-- porcentaje === 100 aunque el examen esté sin aprobar y el certificado no
-- exista — justo la incoherencia que este cambio viene a cerrar.
--
-- Se agregan al final del `select` (no en medio) por el mismo motivo que
-- documenta 062: no reordenar columnas que supabase-js ya consume.
--
-- `auth.uid()` y no un parámetro: la vista es la del estudiante de la sesión
-- (security_invoker = true, acotada por `progreso_select_propio`). Para un
-- administrador —que por `progreso_select_administrador` (028) ve las filas
-- de todos— estas dos columnas responden por SU propio usuario, igual de
-- inservibles que `lecciones_completadas` en ese contexto; el panel admin lee
-- el progreso por otro camino (lib/admin/cursoDetalle.ts).
-- --------------------------------------------------------------
drop view if exists public.progreso_cursos_estudiante;

create view public.progreso_cursos_estudiante
with (security_invoker = true) as
with cursos_tocados as (
  select distinct m.id_curso
  from public.progreso pr
  join public.lecciones l on l.id = pr.id_leccion
  join public.modulos m on m.id = l.id_modulo
)
select
  c.id as curso_id,
  c.slug as curso_slug,
  c.titulo,
  c.imagen_portada,
  c.nivel,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO') as lecciones_total,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO' and pr.completado) as lecciones_completadas,
  max(pr.actualizado_en) as ultima_actividad,
  private.curso_exige_examen(c.id) as examen_requerido,
  private.aprobo_examen_curso((select auth.uid()), c.id) as examen_aprobado
from cursos_tocados ct
join public.cursos c on c.id = ct.id_curso
join public.modulos m on m.id_curso = c.id
join public.lecciones l on l.id_modulo = m.id
left join lateral (
  select bool_or(pr.completado) as completado, max(pr.actualizado_en) as actualizado_en
  from public.progreso pr
  where pr.id_leccion = l.id
) pr on true
group by c.id, c.slug, c.titulo, c.imagen_portada, c.nivel;

grant select on public.progreso_cursos_estudiante to authenticated;
