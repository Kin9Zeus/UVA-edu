-- ============================================================
-- El progreso exige acceso vigente al curso
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-1 (P0).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-069.
--
-- Qué estaba mal
-- --------------
-- Las policies de escritura de `progreso` (019, reescritas en 056)
-- verificaban tres cosas: quién eres, que confirmaste el correo y que no
-- estás suspendido. Nunca verificaron que tuvieras acceso al curso.
--
--   with check (
--     (select auth.uid()) = id_usuario
--     and private.correo_verificado()
--     and private.cuenta_activa()
--   )
--
-- Un usuario registrado, con el correo confirmado y sin ninguna suscripción
-- podía hacer `GET /rest/v1/lecciones` (la policy de lectura solo exige
-- `cursos.mostrado`, así que ve los ids de todo el catálogo) y después un
-- `POST /rest/v1/progreso` por lección con `completado = true`. Al completar
-- la última, el trigger `progreso_emite_certificado` (047/068) llamaba a
-- `private.emitir_certificado`, que solo comprueba "curso completo" — no
-- acceso — y emitía un certificado real, con código verificable
-- públicamente por `verificar_certificado()` (015/020/050).
--
-- Tres de los cuatro cursos del catálogo no publican examen, así que nada
-- más se interponía. El estudiante no veía un solo segundo de video —eso sí
-- lo protege Mux con `playback_policies: ["signed"]`, verificado el
-- 2026-09-03— pero se llevaba el diploma. En una plataforma educativa el
-- certificado *es* el producto.
--
-- No era solo un problema de API directa: la propia Server Action delega la
-- autorización a RLS y lo dice en su comentario
-- (src/actions/progreso/marcar.ts:14). La delegación es correcta; la policy
-- era la que no cumplía su parte.
--
-- Por qué la excepción de la lección introductoria
-- ------------------------------------------------
-- `iniciarProgresoLeccion` (src/actions/progreso/marcar.ts) inserta una fila
-- en `progreso` en cuanto alguien ABRE una clase, no solo cuando la marca
-- completada. La primera lección de cada curso es la clase gratuita del
-- catálogo (private.es_leccion_introductoria, usada ya por
-- comentarios_select_con_acceso en 052). Sin esta excepción, un visitante no
-- podría ni empezar el curso gratuito.
--
-- La excepción no reabre el hueco: es_leccion_introductoria exige que el
-- curso tenga MÁS DE UNA lección y solo devuelve true para la primera por
-- (modulo.orden, leccion.orden). Nunca alcanza para completar un curso.
--
-- Por qué (select …) alrededor del helper
-- ---------------------------------------
-- Mismo motivo que 056: `private.tiene_acceso_vigente_curso` es STABLE, pero
-- Postgres no la promueve a InitPlan por sí sola — la evalúa una vez por
-- fila dentro del Filter. Envuelta en subconsulta escalar se evalúa una vez
-- por sentencia. Ver D-3 de la misma auditoría.
--
-- Verificación previa (transacciones READ ONLY, antes de escribir esto)
-- --------------------------------------------------------------------
--                        | lección introductoria | lección de pago
--   sin acceso           |        permite        |     BLOQUEA
--   con acceso vigente   |        permite        |     permite
-- ============================================================

-- ------------------------------------------------------------
-- PROGRESO: escritura solo con acceso vigente al curso.
-- Reemplaza progreso_insert_propio y progreso_update_propio de 056
-- añadiendo la condición nueva con AND; el resto queda igual.
-- No toca progreso_select_propio ni progreso_delete_propio: un usuario
-- debe poder seguir viendo y borrando su propio historial aunque ya no
-- tenga acceso (mismo criterio que 019 con las cuentas suspendidas).
-- ------------------------------------------------------------
drop policy if exists "progreso_insert_propio" on public.progreso;
create policy "progreso_insert_propio" on public.progreso
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (
      (select private.tiene_acceso_vigente_curso(
        (select m.id_curso
           from public.lecciones l
           join public.modulos m on m.id = l.id_modulo
          where l.id = id_leccion)))
      or private.es_leccion_introductoria(id_leccion)
    )
  );

drop policy if exists "progreso_update_propio" on public.progreso;
create policy "progreso_update_propio" on public.progreso
  for update using ((select auth.uid()) = id_usuario)
  with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (
      (select private.tiene_acceso_vigente_curso(
        (select m.id_curso
           from public.lecciones l
           join public.modulos m on m.id = l.id_modulo
          where l.id = id_leccion)))
      or private.es_leccion_introductoria(id_leccion)
    )
  );

-- ------------------------------------------------------------
-- Segunda capa: la emisión del certificado también comprueba acceso.
--
-- Una policy sola no debería ser lo único entre un `curl` y un diploma. Pero
-- la guardia NO puede usar auth.uid(), y ese detalle es la parte fácil de
-- equivocar:
--
--   - auth.uid() lee el GUC `request.jwt.claims`, que es de sesión.
--     SECURITY DEFINER cambia el ROL, no el GUC, así que dentro del trigger
--     auth.uid() sí devuelve al usuario que llamó... cuando lo hubo.
--   - Pero el trigger también se dispara desde `service_role`, donde
--     auth.uid() es NULL (p. ej. el webhook de Mux escribe sobre `progreso`
--     con el cliente admin — src/app/api/webhooks/mux/route.ts:143). Una
--     guardia basada en auth.uid() bloquearía flujos administrativos
--     legítimos y, peor, comprobaría al sujeto equivocado: el dueño de la
--     fila es `p_id_usuario`, no quien escribe.
--
-- De ahí esta variante parametrizada por usuario.
--
-- Replica exactamente la regla de private.tiene_acceso_vigente_curso
-- (030/038/043), incluida la rama de curso despublicado: una membresía
-- vigente conserva el acceso a un curso retirado del catálogo si YA tenía
-- progreso en él ("ya lo estaba viendo"). No simplificar: quitar esa rama
-- rompe a quien iba a mitad de un curso que se despublicó.
-- ------------------------------------------------------------
create or replace function private.tiene_acceso_vigente_curso_de(
  p_id_usuario uuid,
  p_id_curso uuid
)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    -- Cortesía: acceso incondicional, publicado o no, mientras siga activa.
    exists (
      select 1 from public.inscripciones
      where inscripciones.id_usuario = p_id_usuario
        and inscripciones.id_curso = p_id_curso
        and inscripciones.tipo_acceso = 'CORTESIA'
        and inscripciones.activo = true
    )
    or (
      -- Membresía: solo por suscripción vigente (ver 038).
      private.suscripcion_da_acceso(p_id_usuario)
      and (
        coalesce((select cursos.mostrado from public.cursos where cursos.id = p_id_curso), false)
        or exists (
          select 1
          from public.progreso pr
          join public.lecciones l on l.id = pr.id_leccion
          join public.modulos m on m.id = l.id_modulo
          where pr.id_usuario = p_id_usuario
            and m.id_curso = p_id_curso
        )
      )
    );
$$;

-- Nadie la llama desde la API: solo la usa el trigger, que corre como
-- DEFINER. Mismo criterio que el resto de helpers de `private`.
revoke execute on function private.tiene_acceso_vigente_curso_de(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- emitir_certificado: idéntica a 068 salvo por la guardia de acceso que se
-- añade justo después de la comprobación de "ya tiene certificado".
--
-- El orden importa: primero el atajo de "ya emitido" (para no evaluar la
-- regla completa en el camino común), después acceso, y solo entonces la
-- regla de completitud, que es la más cara.
-- ------------------------------------------------------------
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

  -- Guardia de acceso (D-1). Un certificado no se emite a quien no tuvo
  -- derecho a ver el curso, aunque de algún modo haya conseguido registrar
  -- progreso en todas sus lecciones. Sale en silencio, igual que el resto de
  -- los casos "no corresponde emitir": esto es un trigger AFTER sobre una
  -- escritura legítima del usuario, y lanzar una excepción acá abortaría el
  -- guardado del progreso en vez de solo omitir el certificado.
  if not private.tiene_acceso_vigente_curso_de(p_id_usuario, p_id_curso) then
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
