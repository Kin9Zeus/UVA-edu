-- ============================================================
-- Un administrador SIN segundo factor navega como un estudiante con
-- suscripción vigente. Con el código de la app (aal2) además recibe el poder
-- de administrador (131).
--
-- Orden de aplicación: DESPUÉS de 000-137.
--
-- Qué pasaba
-- ----------
-- 131 hizo que `private.es_administrador()` exigiera aal2. Un administrador
-- que entraba al panel de estudiante con solo la contraseña quedaba como una
-- persona sin suscripción: sin cursos, sin videos, sin notas ni progreso.
-- Tenía que escribir el código para poder estudiar.
--
-- Qué cambia
-- ----------
-- `private.suscripcion_da_acceso(p_id_usuario)` responde true también cuando
-- p_id_usuario es la persona de la sesión en curso y su rol es ADMINISTRADOR,
-- sin mirar el nivel aal. Esa función es la que usan las políticas de lectura
-- del contenido de un curso, el progreso, las notas y el gate de Comunidad:
-- todas heredan la regla sin tocarlas. Es exactamente "ser un estudiante con
-- suscripción", ni un permiso más.
--
-- Qué NO cambia
-- -------------
-- - `es_administrador()` sigue exigiendo aal2 y 12 horas (131): el padrón de
--   usuarios, la bitácora, el CMS y todas las funciones de admin siguen
--   cerradas a una contraseña sola.
-- - Solo vale para la sesión en curso (`auth.uid()`). Cuando el trigger de
--   anuncios pregunta por OTRAS personas, el rol de quien publica no cuenta.
-- - service_role no tiene `auth.uid()`: no se ve afectado.
--
-- Riesgo que se acepta (decisión del equipo, 2026-11-10): con la contraseña
-- robada de un administrador alguien vería el contenido de los cursos, como si
-- fuera un estudiante pagando. No ve datos de otras personas ni puede
-- administrar nada.
-- ============================================================

create or replace function private.suscripcion_da_acceso(p_id_usuario uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    (
      p_id_usuario is not distinct from (select auth.uid())
      and exists (
        select 1 from public.perfiles
        where perfiles.id = p_id_usuario and perfiles.rol = 'ADMINISTRADOR'
      )
    )
    or exists (
      select 1
      from public.suscripciones s
      where s.id_usuario = p_id_usuario
        and (
          (
            s.estado = 'ACTIVA'
            and (
              s.fecha_renovacion is null
              or (s.fecha_renovacion at time zone 'America/Bogota')::date
                 >= (now() at time zone 'America/Bogota')::date
            )
          )
          or (
            s.estado = 'PAST_DUE'
            and (
              s.fecha_renovacion is null
              or s.fecha_renovacion + interval '5 days' > now()
            )
          )
        )
    );
$$;

grant execute on function private.suscripcion_da_acceso(uuid) to authenticated;
