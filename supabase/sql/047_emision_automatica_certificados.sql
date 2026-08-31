-- ============================================================
-- Emisión automática de certificados (Certificado.md)
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-046.
--
-- docs/functional-spec.md Flujo 07, paso 1-2: "El trigger de la base de
-- datos detecta que todas las lecciones asociadas a un curso poseen un
-- registro de progreso con completado = true... Se inserta una entrada en
-- la tabla certificados". Ese trigger nunca se había escrito — la tabla
-- `certificados` (001_rls_policies.sql) solo tenía política de SELECT, sin
-- ningún camino de escritura, así que /dashboard/certificados siempre
-- mostraba una lista vacía sin importar cuántos cursos terminara un
-- estudiante.
--
-- Por qué un trigger sobre `progreso` y no un Server Action
-- --------------------------------------------------------------
-- Guardar progreso (marcar una lección como vista) ya se hace por RLS
-- directo del cliente (`progreso_propio`, 001/008/019), sin pasar por
-- ningún Server Action que pudiera "además" chequear el 100% del curso y
-- emitir el certificado. Detectarlo en la base es la única forma de que la
-- emisión no dependa de que cada punto de la app que actualiza `progreso`
-- recuerde llamar a una función aparte.
--
-- SECURITY DEFINER es obligatorio aquí, no una preferencia de estilo: el
-- trigger corre en el contexto de la sesión del estudiante (quien hizo el
-- UPDATE de `progreso`), que solo tiene permiso de SELECT sobre
-- `certificados`. Sin SECURITY DEFINER, el INSERT de más abajo violaría RLS
-- y reventaría el guardado de progreso del estudiante con un error ajeno a
-- lo que estaba haciendo.
-- ============================================================

-- --------------------------------------------------------------
-- Código de verificación: 10 caracteres del mismo alfabeto legible que
-- codigoInvitacion.ts (sin 0/O/1/I/L), agrupados XXXXX-XXXXX. Se genera en
-- SQL (no en TypeScript, como los códigos de invitación) porque quien lo
-- necesita es un trigger, no un Server Action — no hay ninguna capa de
-- aplicación en medio para generarlo antes del INSERT.
--
-- Usa pgcrypto (gen_random_bytes, ya habilitado desde
-- 20260818142831_suscripcion_activa_unica_y_pgcrypto) en vez de random():
-- mismo criterio que generarCodigoInvitacion (CSPRNG, no un generador
-- predecible), aunque aquí el código no es un secreto que otorgue acceso —
-- solo confirma la validez de un certificado ya público por diseño.
--
-- `extensions.gen_random_bytes`, calificado explícito: en este proyecto de
-- Supabase pgcrypto vive en el schema `extensions`, no en `public` (a
-- diferencia de gen_random_uuid(), que desde Postgres 13 es una función del
-- core y por eso el resto del esquema la usa sin calificar). Depender de
-- que `extensions` esté en el search_path sería frágil entre entornos —
-- calificarla siempre resuelve igual.
-- --------------------------------------------------------------
create or replace function private.generar_codigo_certificado()
returns text
language plpgsql
volatile
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

create or replace function private.emitir_certificado_si_completo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_curso     uuid;
  v_total        int;
  v_completadas  int;
  v_codigo       text;
  v_intentos     int := 0;
begin
  select m.id_curso into v_id_curso
  from public.lecciones l
  join public.modulos m on m.id = l.id_modulo
  where l.id = new.id_leccion;

  -- Lección huérfana (no debería pasar, FK mediante): nada que emitir.
  if v_id_curso is null then
    return new;
  end if;

  -- Ya tiene certificado de este curso: `certificados_id_usuario_id_curso_key`
  -- (unique en el modelo) es la fuente de verdad de "ya emitido", esto solo
  -- evita el trabajo de contar lecciones en el camino común (progreso que se
  -- sigue actualizando en un curso ya certificado).
  if exists (
    select 1 from public.certificados
    where id_usuario = new.id_usuario and id_curso = v_id_curso
  ) then
    return new;
  end if;

  -- Mismo criterio que la vista progreso_cursos_estudiante (033): solo
  -- cuentan las lecciones con video LISTO. Una lección SUBIENDO/PROCESANDO/
  -- ERROR no es completable por el estudiante, así que no puede bloquear
  -- la emisión ni, al revés, dejar "completo" un curso al que le falta
  -- contenido real por publicar.
  select
    count(*) filter (where l.estado_procesamiento = 'LISTO'),
    count(*) filter (
      where l.estado_procesamiento = 'LISTO'
        and exists (
          select 1 from public.progreso p
          where p.id_leccion = l.id
            and p.id_usuario = new.id_usuario
            and p.completado
        )
    )
  into v_total, v_completadas
  from public.lecciones l
  join public.modulos m on m.id = l.id_modulo
  where m.id_curso = v_id_curso;

  if v_total = 0 or v_completadas < v_total then
    return new;
  end if;

  -- Reintenta solo si choca el código (23505 en codigo_verificacion, ~1 en
  -- 31^10 — casi imposible pero no descartable, mismo criterio que
  -- crearLoteCodigosInvitacion). Si el choque es por (id_usuario, id_curso)
  -- en cambio, es una carrera legítima (dos UPDATE de progreso del mismo
  -- estudiante llegando a la vez) y no un choque de código: sale sin error,
  -- el otro insert ya hizo el trabajo.
  loop
    v_intentos := v_intentos + 1;
    v_codigo := private.generar_codigo_certificado();
    begin
      insert into public.certificados (id_usuario, id_curso, codigo_verificacion)
      values (new.id_usuario, v_id_curso, v_codigo);
      exit;
    exception when unique_violation then
      if exists (
        select 1 from public.certificados
        where id_usuario = new.id_usuario and id_curso = v_id_curso
      ) then
        exit;
      end if;
      if v_intentos >= 5 then
        raise exception 'No se pudo generar un código de certificado único tras % intentos', v_intentos;
      end if;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists progreso_emite_certificado on public.progreso;
create trigger progreso_emite_certificado
  after insert or update of completado on public.progreso
  for each row
  when (new.completado = true)
  execute function private.emitir_certificado_si_completo();
