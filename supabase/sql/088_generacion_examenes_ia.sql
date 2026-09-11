-- ============================================================
-- RLS y privilegios: transcripciones_video, trabajos_generacion_examen,
-- y las columnas de procedencia de preguntas_examen.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-087, y
-- después de correr la migración de Prisma que crea las dos tablas
-- (prisma/migrations/20260909000000_generacion_examenes_ia).
--
-- Modelo de amenaza
-- -----------------
-- `transcripciones_video` guarda, en texto plano y sin firmar, la clase
-- entera. Es el mismo contenido por el que se paga la suscripción, pero sin
-- el candado que lo protege en su forma nativa: el video solo se reproduce
-- con una URL firmada de Mux que caduca (src/lib/video/reproduccion.ts),
-- mientras que un SELECT sobre esta tabla devuelve el curso completo en una
-- petición, copiable y redistribuible.
--
-- Por eso NO se abre a `authenticated` ni siquiera con acceso vigente al
-- curso —que es lo que sí hace `examenes` para su pantalla previa—: ninguna
-- pantalla del estudiante necesita la transcripción. El día que exista un
-- buscador dentro de la clase, se resuelve con una función SECURITY DEFINER
-- que devuelva el fragmento que rodea al término buscado, no abriendo la
-- tabla.
--
-- `trabajos_generacion_examen` es menos sensible pero igual de innecesario
-- para el estudiante: es bitácora de operación.
--
-- Las dos tablas se escriben ÚNICAMENTE con Service Role — el webhook de Mux
-- y los Server Actions de administrador. Ninguna tiene política de INSERT,
-- UPDATE ni DELETE: con RLS activo y sin política, Postgres deniega. Mismo
-- criterio que `intentos_examen` en 067.
-- ============================================================

alter table public.transcripciones_video enable row level security;
alter table public.trabajos_generacion_examen enable row level security;

-- --------------------------------------------------------------
-- transcripciones_video
--
-- Solo administradores leen, y solo para el panel que muestra si un video ya
-- tiene transcripción lista (y para revisar a mano la de un video que quedó
-- con cero preguntas validadas).
--
-- `generateCourseExam()` no depende de esta policy: corre con Service Role,
-- que salta RLS. La policy existe para que el panel pueda consultar desde el
-- cliente autenticado sin abrir un endpoint nuevo.
-- --------------------------------------------------------------
drop policy if exists "transcripciones_video_admin_select" on public.transcripciones_video;
create policy "transcripciones_video_admin_select" on public.transcripciones_video
  for select using (private.es_administrador());

-- --------------------------------------------------------------
-- trabajos_generacion_examen
-- --------------------------------------------------------------
drop policy if exists "trabajos_generacion_examen_admin_select" on public.trabajos_generacion_examen;
create policy "trabajos_generacion_examen_admin_select" on public.trabajos_generacion_examen
  for select using (private.es_administrador());

-- --------------------------------------------------------------
-- Privilegios (capa distinta de las policies — ver 081)
--
-- Supabase concede por defecto SELECT/INSERT/UPDATE/DELETE sobre toda tabla
-- nueva de `public` a `anon` y `authenticated`. Las policies de arriba ya
-- cierran las FILAS, pero el REVOKE quita el filo entero: si mañana alguien
-- agrega una policy más laxa sin pensar en la transcripción completa, el
-- privilegio ya no está para respaldarla.
--
-- `anon` pierde todo en las dos tablas. `authenticated` conserva SELECT
-- porque la policy de administrador se evalúa bajo ese rol (un admin es un
-- usuario autenticado, no un rol de Postgres propio); sin el privilegio, el
-- panel recibiría un permission denied antes de que la policy llegue a
-- decidir.
-- --------------------------------------------------------------
revoke all on public.transcripciones_video from anon;
revoke all on public.trabajos_generacion_examen from anon;

revoke insert, update, delete on public.transcripciones_video from authenticated;
revoke insert, update, delete on public.trabajos_generacion_examen from authenticated;

grant select on public.transcripciones_video to authenticated;
grant select on public.trabajos_generacion_examen to authenticated;

grant all on public.transcripciones_video to service_role;
grant all on public.trabajos_generacion_examen to service_role;

-- --------------------------------------------------------------
-- preguntas_examen: las columnas nuevas no cambian nada
--
-- `fragmento_origen` es una frase textual de la transcripción, así que es
-- contenido pagado igual que la transcripción entera — pero no hace falta
-- ninguna regla nueva para protegerlo: 067 ya deja el SELECT de
-- `preguntas_examen` exclusivamente en manos de administradores (la tabla
-- contiene las respuestas correctas). Las tres columnas heredan esa puerta.
--
-- Se deja constancia acá en vez de en un comentario suelto porque la próxima
-- persona que agregue una columna a esta tabla va a buscar en este directorio
-- si hacía falta tocar RLS. La respuesta es no, y este es el porqué.
-- --------------------------------------------------------------
comment on column public.preguntas_examen.fragmento_origen is
  'Frase textual de la transcripción que ancla la pregunta. Contenido pagado: '
  'legible solo por administradores, vía la policy de SELECT de 067.';
comment on column public.preguntas_examen.validada is
  'null = pregunta escrita a mano (no aplica); true = generada por IA y con '
  'fragmento verificado contra la transcripción; false = generada y no verificada.';
comment on column public.preguntas_examen.id_leccion_origen is
  'Lección (video) de la que salió la pregunta. null = escrita a mano.';
