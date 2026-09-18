-- ============================================================
-- Cuando el curso exige examen, aprobarlo basta para certificar — ya no hace
-- falta además el 100% de lecciones vistas (Revf6).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-113.
--
-- El problema
-- -----------
-- `private.curso_esta_completo` (068) exigía las DOS cosas a la vez:
--
--   lecciones_completas_curso(u,c) AND (NOT curso_exige_examen(c) OR aprobo_examen_curso(u,c))
--
-- Pero el examen mismo YA se puede rendir sin haber visto ninguna lección
-- (067/`src/lib/examen.ts`, decisión de producto "acceso libre" tomada
-- después de 068). El resultado era una regla a medias: el examen no exige
-- el temario en un extremo del flujo, pero la certificación sí lo exigía en
-- el otro. Un estudiante que aprobaba el examen sin terminar las clases
-- quedaba en "EN_PROGRESO" en toda la app —dashboard propio, lista de
-- estudiantes del admin, detalle de usuario— y sin certificado, aunque para
-- la plataforma "aprobó el examen" ya es la señal de que domina el curso.
--
-- El cambio
-- ---------
-- Cuando el curso exige examen, la regla pasa a ser SOLO el examen: aprobó o
-- no aprobó. Cuando no lo exige, la regla sigue siendo la de siempre (100%
-- de lecciones) — comportamiento previo a los exámenes, sin cambios.
--
-- Lo que NO cambia
-- -----------------
-- Ni los triggers que emiten el certificado (`progreso_emite_certificado`,
-- `intento_examen_emite_certificado`, ambos en 068) ni `private.emitir_certificado`
-- (070): los dos ya escuchan "se completó una lección" Y "se aprobó un
-- examen" como caminos independientes, y los dos llaman a
-- `curso_esta_completo` para decidir. Basta con redefinir esta función para
-- que el camino "aprobó el examen" empiece a alcanzar por sí solo.
-- Tampoco cambian los wrappers públicos (068) ni la vista
-- `progreso_cursos_estudiante` (068), que expone `examen_requerido` /
-- `examen_aprobado` por su cuenta sin pasar por `curso_esta_completo`.
-- ============================================================

create or replace function private.curso_esta_completo(p_id_usuario uuid, p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select case
    when private.curso_exige_examen(p_id_curso)
      then private.aprobo_examen_curso(p_id_usuario, p_id_curso)
    else private.lecciones_completas_curso(p_id_usuario, p_id_curso)
  end;
$$;

revoke execute on function private.curso_esta_completo(uuid, uuid) from public;
grant execute on function private.curso_esta_completo(uuid, uuid) to authenticated;
