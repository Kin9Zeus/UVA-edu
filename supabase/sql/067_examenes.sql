-- ============================================================
-- Row Level Security (RLS): examenes, preguntas_examen, intentos_examen
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-066, y
-- después de correr la migración de Prisma que crea las tres tablas
-- (prisma/migrations/20260907020000_examenes_finales).
--
-- Modelo de amenaza — por qué las políticas son tan cerradas
-- ----------------------------------------------------------
-- Estas tablas deciden quién obtiene un certificado. A diferencia de
-- `progreso` (donde lo peor que puede hacer un estudiante es mentir sobre
-- qué vio), acá hay dos superficies que un estudiante motivado atacaría
-- directamente contra PostgREST, sin pasar por la UI:
--
--   1. LEER LAS RESPUESTAS. `preguntas_examen` contiene, en claro, cuál
--      opción es la correcta y qué respuestas de texto se aceptan. Un
--      SELECT sobre esa tabla es el examen resuelto.
--      -> SELECT solo para administradores. El estudiante NUNCA lee esta
--         tabla: recibe las preguntas ya despojadas de las respuestas, y las
--         recibe desde `intentos_examen.preguntas_congeladas`, que el Server
--         Action llena con `prepararPreguntasParaEstudiante()`.
--
--   2. ESCRIBIR SU PROPIA NOTA. Con una policy de UPDATE del estilo
--      `auth.uid() = id_usuario` —la que este proyecto usa en `progreso` y
--      que sería el reflejo natural acá— un estudiante haría
--      `PATCH /rest/v1/intentos_examen?id=eq.<suyo>` con
--      {"estado":"APROBADO","puntaje_pct":100} y se autoemitiría el
--      certificado, porque el trigger de emisión (067) confía en `estado`.
--      -> `intentos_examen` NO TIENE ninguna política de INSERT, UPDATE ni
--         DELETE. Con RLS activo y sin política, Postgres deniega: no hay
--         camino de escritura desde el cliente, ni siquiera para el dueño de
--         la fila. Iniciar, autoguardar y enviar un intento pasan siempre por
--         Server Actions (src/actions/examenes/intento.ts) que usan el
--         cliente de Service Role — el único con permiso — después de
--         verificar a mano la identidad y el acceso al curso.
--
-- Esa asimetría es deliberada y es la diferencia con `progreso`: acá el
-- servidor no puede delegar la autorización a RLS, porque el dato que
-- escribe (la nota) es exactamente el dato que el usuario querría falsificar.
-- ============================================================

alter table public.examenes enable row level security;
alter table public.preguntas_examen enable row level security;
alter table public.intentos_examen enable row level security;

-- --------------------------------------------------------------
-- examenes
--
-- El estudiante sí necesita leer la fila del examen (título, instrucciones,
-- cuántos intentos tiene, si hay tiempo límite) para la pantalla previa al
-- inicio. Nada de eso revela respuestas.
--
-- Solo si está `publicado`: un examen en borrador no existe para el
-- estudiante — ni se le anuncia, ni bloquea su certificación (ver
-- private.curso_esta_completo en 067). Mismo criterio que `cursos.mostrado`.
--
-- Y solo con acceso vigente al curso (private.tiene_acceso_vigente_curso,
-- 039): sin membresía ni cortesía, el examen del curso no es asunto suyo.
-- --------------------------------------------------------------
drop policy if exists "examenes_select_publicado_con_acceso" on public.examenes;
create policy "examenes_select_publicado_con_acceso" on public.examenes
  for select using (
    private.es_administrador()
    or (publicado = true and private.tiene_acceso_vigente_curso(id_curso))
  );

drop policy if exists "examenes_admin_insert" on public.examenes;
create policy "examenes_admin_insert" on public.examenes
  for insert with check (private.es_administrador());

drop policy if exists "examenes_admin_update" on public.examenes;
create policy "examenes_admin_update" on public.examenes
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "examenes_admin_delete" on public.examenes;
create policy "examenes_admin_delete" on public.examenes
  for delete using (private.es_administrador());

-- --------------------------------------------------------------
-- preguntas_examen — el examen resuelto. Solo administradores, en las
-- cuatro operaciones. Sin excepción para el estudiante que está rindiendo:
-- lo que él ve sale de su propio `intentos_examen.preguntas_congeladas`.
-- --------------------------------------------------------------
drop policy if exists "preguntas_examen_admin_select" on public.preguntas_examen;
create policy "preguntas_examen_admin_select" on public.preguntas_examen
  for select using (private.es_administrador());

drop policy if exists "preguntas_examen_admin_insert" on public.preguntas_examen;
create policy "preguntas_examen_admin_insert" on public.preguntas_examen
  for insert with check (private.es_administrador());

drop policy if exists "preguntas_examen_admin_update" on public.preguntas_examen;
create policy "preguntas_examen_admin_update" on public.preguntas_examen
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "preguntas_examen_admin_delete" on public.preguntas_examen;
create policy "preguntas_examen_admin_delete" on public.preguntas_examen
  for delete using (private.es_administrador());

-- --------------------------------------------------------------
-- intentos_examen — SELECT y nada más.
--
-- El estudiante lee sus propios intentos (la pantalla del examen, el
-- historial y el resultado se renderizan desde acá). El administrador lee
-- todos, para el reporte por curso.
--
-- No hay política de escritura A PROPÓSITO: ver el modelo de amenaza al
-- principio del archivo. Si alguna vez hace falta agregar una, la pregunta
-- que hay que responder primero es cómo se impide que el cliente escriba
-- `estado`/`puntaje_pct` — no basta con acotar la fila.
--
-- Ojo con `preguntas_congeladas`: incluye las respuestas correctas (el
-- servidor las necesita para calificar sin volver a leer `preguntas_examen`,
-- que pudo haber cambiado). RLS protege filas, no columnas, así que esa
-- columna sería legible por su dueño. Por eso `getIntentoEnCurso()`
-- (src/lib/examen.ts) proyecta columnas explícitas y NUNCA la incluye, y el
-- cliente recibe solo la versión despojada. La defensa real es esa
-- proyección más el hecho de que la app nunca expone la fila cruda; si en el
-- futuro alguien consulta esta tabla con `select *` desde el navegador,
-- estaría filtrando el examen resuelto.
-- --------------------------------------------------------------
drop policy if exists "intentos_examen_select_propio_o_admin" on public.intentos_examen;
create policy "intentos_examen_select_propio_o_admin" on public.intentos_examen
  for select using (
    (select auth.uid()) = id_usuario
    or private.es_administrador()
  );

-- --------------------------------------------------------------
-- Reordenar preguntas (drag & drop del CMS), gemela de
-- reespaciar_orden_modulos/lecciones (029) y por los mismos motivos: el
-- camino feliz escribe un solo `orden` fraccionado (ordenEntre, lib/orden.ts)
-- y esta función solo entra cuando ya no queda hueco entre dos vecinos,
-- reespaciando el examen completo en UNA sentencia transaccional en vez de un
-- UPDATE por fila desde el cliente.
--
-- Restringida a `service_role`: el Server Action que la llama
-- (moverPregunta, src/actions/admin/examenes.ts) ya verificó el rol
-- ADMINISTRADOR con requireAdmin() antes de invocarla.
--
-- El filtro `id_examen = p_examen_id` es defensa en profundidad: aunque
-- `p_ids` trajera el id de una pregunta de otro examen, esa fila no se toca.
-- --------------------------------------------------------------
create or replace function public.reespaciar_orden_preguntas(p_examen_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.preguntas_examen q
  set orden = t.nuevo_orden
  from (
    select id, (ordinality::int) * 10 as nuevo_orden
    from unnest(p_ids) with ordinality as u(id, ordinality)
  ) t
  where q.id = t.id and q.id_examen = p_examen_id;
end;
$$;

revoke execute on function public.reespaciar_orden_preguntas(uuid, uuid[]) from public;
revoke execute on function public.reespaciar_orden_preguntas(uuid, uuid[]) from anon;
revoke execute on function public.reespaciar_orden_preguntas(uuid, uuid[]) from authenticated;
grant execute on function public.reespaciar_orden_preguntas(uuid, uuid[]) to service_role;

-- --------------------------------------------------------------
-- ¿Este curso exige aprobar examen?
--
-- La usan el trigger de certificación (067) y la vista de progreso del
-- estudiante. SECURITY DEFINER porque el trigger corre en la sesión del
-- estudiante, que no puede ver un examen despublicado — y ahí sí importa:
-- un examen en borrador no debe bloquear la certificación, pero tampoco
-- debe parecer inexistente por un problema de permisos en vez de por su
-- estado real.
-- --------------------------------------------------------------
create or replace function private.curso_exige_examen(p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.examenes
    where id_curso = p_id_curso and publicado = true
  );
$$;

revoke execute on function private.curso_exige_examen(uuid) from public;
grant execute on function private.curso_exige_examen(uuid) to authenticated;

-- --------------------------------------------------------------
-- ¿Este estudiante ya aprobó el examen de este curso?
--
-- "Aprobado" es tener al menos un intento en estado APROBADO. Se mira el
-- estado y no `puntaje_pct >= nota_aprobatoria` a propósito: el intento
-- congeló en `nota_requerida` el umbral vigente cuando lo rindió, así que
-- subir la exigencia del examen después no debe reprobar retroactivamente a
-- quien ya pasó — mismo criterio que Revf3/Revf4 con los certificados ya
-- emitidos (docs/functional-spec.md Flujo 07).
-- --------------------------------------------------------------
create or replace function private.aprobo_examen_curso(p_id_usuario uuid, p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.intentos_examen i
    join public.examenes e on e.id = i.id_examen
    where i.id_usuario = p_id_usuario
      and e.id_curso = p_id_curso
      and i.estado = 'APROBADO'
  );
$$;

revoke execute on function private.aprobo_examen_curso(uuid, uuid) from public;
grant execute on function private.aprobo_examen_curso(uuid, uuid) to authenticated;
