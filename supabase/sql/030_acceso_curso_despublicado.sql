-- ============================================================
-- Acceso a un curso despublicado para quien ya lo estaba viendo
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 028.
--
-- Qué se arregla
-- --------------
-- Revcurso ("Publicar/ocultar curso y modo vista previa") pedía: "Despublicar
-- un curso no borra el progreso de quienes ya lo estaban viendo — solo lo
-- oculta del catálogo". El progreso en sí nunca se borraba (alternarPublicacionCurso
-- solo toca `cursos.mostrado`), pero las policies de SELECT de cursos, modulos,
-- lecciones y curso_categorias solo dejaban pasar `mostrado = true or admin`,
-- así que un estudiante con acceso vigente perdía la clase igual que un
-- visitante nuevo: no era "ocultar del catálogo", era cortar el acceso.
--
-- La regla nueva distingue cómo se consiguió el acceso:
--   - Cortesía (fila en `inscripciones`): siempre puede seguir entrando,
--     publicado o no. Es un regalo directo a esa persona a ESE curso,
--     nunca dependió del catálogo.
--   - Membresía (suscripción ACTIVA/PAST_DUE, sin fila en `inscripciones`
--     porque da acceso a todo el catálogo publicado por igual): sigue
--     pudiendo entrar solo si el curso sigue publicado, O si ya tiene
--     progreso guardado en ÉL — o sea, si ya lo "estaba viendo". Un
--     suscriptor que nunca abrió ese curso no gana nada especial al
--     despublicarse: deja de verlo, igual que cualquier otro.
--
-- Sin esta distinción, extender el acceso a "cualquiera con membresía
-- activa" habría dejado el unpublish sin ningún efecto real para ese tipo
-- de acceso (todo suscriptor "tiene acceso" a todo el catálogo por
-- definición, lo haya abierto o no).
-- ============================================================

-- ¿El usuario autenticado tiene progreso guardado en alguna clase de este
-- curso? — "ya lo estaba viendo", el criterio que separa a un suscriptor
-- que ya arrancó el curso de uno que nunca lo tocó.
create or replace function private.tiene_progreso_en_curso(p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.progreso
    join public.lecciones on lecciones.id = progreso.id_leccion
    join public.modulos on modulos.id = lecciones.id_modulo
    where progreso.id_usuario = auth.uid()
      and modulos.id_curso = p_id_curso
  );
$$;

grant execute on function private.tiene_progreso_en_curso(uuid) to authenticated;

-- Acceso vigente a un curso, publicado o no. Usada en las policies de
-- SELECT como la excepción a "mostrado = true": permite ver un curso
-- despublicado solo a quien tiene un motivo válido para seguir viéndolo.
create or replace function private.tiene_acceso_vigente_curso(p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    -- Cortesía: acceso incondicional, publicado o no. `ofrecerCortesia()`
    -- (src/actions/admin/usuarios.ts) es hoy el único que escribe en
    -- `inscripciones`, siempre con tipo_acceso = 'CORTESIA' — pero la
    -- policy de auto-inscripción (019_cuenta_activa_rls.sql) sí permite
    -- que un estudiante se autoinscriba con tipo_acceso = 'MEMBRESIA', así
    -- que no basta con "existe una fila en inscripciones": hay que mirar
    -- el tipo, o una MEMBRESIA quedaría con el mismo privilegio que una
    -- CORTESIA.
    exists (
      select 1 from public.inscripciones
      where inscripciones.id_usuario = auth.uid()
        and inscripciones.id_curso = p_id_curso
        and inscripciones.tipo_acceso = 'CORTESIA'
    )
    or (
      -- Membresía: por inscripción MEMBRESIA o por suscripción activa
      -- (son la misma "clase" de acceso — global al catálogo publicado).
      -- Solo alcanza a un curso despublicado si ya tenía progreso en él.
      (
        exists (
          select 1 from public.inscripciones
          where inscripciones.id_usuario = auth.uid()
            and inscripciones.id_curso = p_id_curso
            and inscripciones.tipo_acceso = 'MEMBRESIA'
        )
        or exists (
          select 1 from public.suscripciones
          where suscripciones.id_usuario = auth.uid()
            and suscripciones.estado in ('ACTIVA', 'PAST_DUE')
        )
      )
      and (
        coalesce((select cursos.mostrado from public.cursos where cursos.id = p_id_curso), false)
        or private.tiene_progreso_en_curso(p_id_curso)
      )
    );
$$;

grant execute on function private.tiene_acceso_vigente_curso(uuid) to authenticated;

-- ------------------------------------------------------------
-- CURSOS, MÓDULOS, LECCIONES, CURSO_CATEGORIAS
-- Mismo patrón de 001/002/021, con la excepción de acceso vigente añadida.
-- ------------------------------------------------------------

drop policy if exists "cursos_select_publicos" on public.cursos;
create policy "cursos_select_publicos" on public.cursos
  for select using (
    mostrado = true
    or private.es_administrador()
    or private.tiene_acceso_vigente_curso(id)
  );

drop policy if exists "modulos_select_curso_publico" on public.modulos;
create policy "modulos_select_curso_publico" on public.modulos
  for select using (
    exists (
      select 1 from public.cursos
      where cursos.id = modulos.id_curso
        and (
          cursos.mostrado = true
          or private.es_administrador()
          or private.tiene_acceso_vigente_curso(cursos.id)
        )
    )
  );

drop policy if exists "lecciones_select_curso_publico" on public.lecciones;
create policy "lecciones_select_curso_publico" on public.lecciones
  for select using (
    exists (
      select 1 from public.modulos
      join public.cursos on cursos.id = modulos.id_curso
      where modulos.id = lecciones.id_modulo
        and (
          cursos.mostrado = true
          or private.es_administrador()
          or private.tiene_acceso_vigente_curso(cursos.id)
        )
    )
  );

drop policy if exists "curso_categorias_select_publico" on public.curso_categorias;
create policy "curso_categorias_select_publico" on public.curso_categorias
  for select using (
    exists (
      select 1 from public.cursos
      where cursos.id = curso_categorias.id_curso
        and (
          cursos.mostrado = true
          or private.es_administrador()
          or private.tiene_acceso_vigente_curso(cursos.id)
        )
    )
  );

-- ------------------------------------------------------------
-- RECURSOS_DESCARGABLES
-- Tenía su propio criterio (003_rls_membresia_y_gestion.sql): inscripción o
-- suscripción activa, SIN mirar `cursos.mostrado` en absoluto — un
-- suscriptor podía bajar materiales de un curso despublicado aunque nunca
-- lo hubiera abierto. Se reemplaza por `tiene_acceso_vigente_curso()` para
-- que material descargable siga exactamente la misma regla que el video y
-- el temario de la lección a la que pertenece.
-- ------------------------------------------------------------
drop policy if exists "recursos_select_con_acceso" on public.recursos_descargables;
create policy "recursos_select_con_acceso" on public.recursos_descargables
  for select using (
    private.es_administrador()
    or exists (
      select 1 from public.lecciones
      join public.modulos on modulos.id = lecciones.id_modulo
      where lecciones.id = recursos_descargables.id_leccion
        and private.tiene_acceso_vigente_curso(modulos.id_curso)
    )
  );
