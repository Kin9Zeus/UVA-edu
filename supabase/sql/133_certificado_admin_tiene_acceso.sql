-- ============================================================
-- La guardia de acceso de la emisión de certificados reconoce al administrador.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-132.
--
-- El problema
-- -----------
-- `private.emitir_certificado` (070) no emite si el usuario no tiene acceso
-- vigente al curso (`tiene_acceso_vigente_curso_de`: cortesía activa, o
-- suscripción vigente + curso mostrado o con progreso). Esa regla existe para
-- que nadie saque un diploma de un curso que no pudo ver.
--
-- Pero un ADMINISTRADOR ve todo por su rol, sin suscripción ni cortesía: la
-- app lo deja entrar y las policies lo dejan leer (`es_administrador()`), solo
-- esta guardia no lo conocía. Un admin sin suscripción vigente aprobaba el
-- examen, `curso_esta_completo` daba true y el trigger salía en silencio: sin
-- certificado y sin ningún error.
--
-- El cambio
-- ---------
-- Se añade la rama "el usuario del parámetro es ADMINISTRADOR". Se compara por
-- `p_id_usuario` y no con `private.es_administrador()` porque esta función
-- corre también desde `service_role` (auth.uid() es NULL) y el sujeto es el
-- dueño de la fila, no quien escribe (ver 070).
--
-- Lo que NO cambia
-- ----------------
-- El acceso se sigue comprobando al EMITIR. Quien aprobó con acceso conserva
-- su certificado aunque luego lo pierda (la lectura y la descarga no miran
-- acceso), y quien no lo tiene no puede sacar certificados de otros cursos.
-- ============================================================

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
    -- Administrador: acceso a todo, como en la app y en las policies.
    exists (
      select 1 from public.perfiles
      where perfiles.id = p_id_usuario
        and perfiles.rol = 'ADMINISTRADOR'
    )
    -- Cortesía: acceso incondicional, publicado o no, mientras siga activa.
    or exists (
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

revoke execute on function private.tiene_acceso_vigente_curso_de(uuid, uuid) from public, anon, authenticated;
