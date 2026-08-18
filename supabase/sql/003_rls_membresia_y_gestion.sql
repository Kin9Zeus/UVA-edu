-- ============================================================
-- Row Level Security (RLS): Membresía, Pagos, Cupones y Gestión
-- Ver docs/technical-spec.md §5 (Seguridad y RLS) y
-- docs/functional-spec.md §2.2 (Matriz de Accesos) y Flujo 11.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000, 001 y 002.
-- No modifica ninguna política existente de 000/001/002 — solo agrega
-- políticas nuevas sobre tablas que 001_rls_policies.sql dejó con RLS
-- activo pero sin política propia (bloqueadas por completo salvo
-- Service Role), documentadas ahí como pendientes de Fase 2/4 del
-- development-plan.md.
--
-- Tablas cubiertas: planes, suscripciones, pagos, cupones,
-- inscripciones, recursos_descargables, bitacora_administrativa,
-- eventos_webhook (esta última queda intencionalmente sin política,
-- ver nota al final).
--
-- Cada `create policy` va precedido de un `drop policy if exists` del
-- mismo nombre, para que el archivo completo se pueda volver a correr
-- de forma segura tras una edición (mismo patrón que 002).
-- ============================================================

-- ------------------------------------------------------------
-- PLANES
-- Lectura pública de planes activos (igual que categorías/cursos
-- publicados) para que el catálogo de precios sea visible sin login.
-- ------------------------------------------------------------
drop policy if exists "planes_select_publico" on public.planes;
create policy "planes_select_publico" on public.planes
  for select using (activo = true or private.es_administrador());

drop policy if exists "planes_admin_escritura" on public.planes;
create policy "planes_admin_escritura" on public.planes
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- SUSCRIPCIONES
-- El usuario solo lee las suyas. Cero escritura de cliente: el estado
-- de una suscripción lo cambia exclusivamente el backend al procesar
-- webhooks de Stripe/Wompi con la Service Role Key, que ignora RLS
-- por completo — no existe policy de insert/update para authenticated.
-- ------------------------------------------------------------
drop policy if exists "suscripciones_select_propio" on public.suscripciones;
create policy "suscripciones_select_propio" on public.suscripciones
  for select using (auth.uid() = id_usuario or private.es_administrador());

drop policy if exists "suscripciones_admin_gestiona" on public.suscripciones;
create policy "suscripciones_admin_gestiona" on public.suscripciones
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- PAGOS
-- El usuario solo lee los pagos de sus propias suscripciones (vía
-- join). Cero escritura de cliente: los registros de pago los inserta
-- el backend al procesar webhooks, con Service Role Key.
-- ------------------------------------------------------------
drop policy if exists "pagos_select_propio" on public.pagos;
create policy "pagos_select_propio" on public.pagos
  for select using (
    exists (
      select 1 from public.suscripciones
      where suscripciones.id = pagos.id_suscripcion
        and suscripciones.id_usuario = auth.uid()
    )
    or private.es_administrador()
  );

drop policy if exists "pagos_admin_gestiona" on public.pagos;
create policy "pagos_admin_gestiona" on public.pagos
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- CUPONES
-- Intencionalmente SIN policy de SELECT para anon/authenticated: un
-- cupón expone código, tipo de descuento, valor, límite y usos, datos
-- que no deben ser consultables directamente por el cliente. La
-- validación de un código al aplicar en checkout se hace vía Server
-- Action con Service Role Key desde el backend, nunca con una query
-- directa del cliente contra esta tabla.
-- ------------------------------------------------------------
drop policy if exists "cupones_admin_gestiona" on public.cupones;
create policy "cupones_admin_gestiona" on public.cupones
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- INSCRIPCIONES
-- El estudiante ve las suyas y puede insertar su propia inscripción
-- de tipo MEMBRESIA (alta automática al entrar por primera vez a un
-- curso con Suscripción activa/past_due, ver docs/functional-spec.md
-- Flujo 01 y comentario de TipoAcceso en schema.prisma). El admin
-- gestiona todo, incluyendo las cortesías del Flujo 11 (que llevan
-- otorgado_por y no requieren suscripción activa del estudiante).
-- Sin policy de update/delete para el estudiante: una vez inscrito
-- dentro de su membresía no tiene razón de negocio para editar o
-- borrar ese registro él mismo.
--
-- inscripciones_insert_propio también fija tipo_acceso = 'MEMBRESIA'
-- y otorgado_por is null en el with check: sin esas dos condiciones,
-- un estudiante podría insertar su propia fila con
-- tipo_acceso = 'CORTESIA' y un otorgado_por arbitrario, haciéndola
-- indistinguible de una cortesía real otorgada por un administrador
-- (que solo debería poder crearse vía inscripciones_admin_gestiona).
-- ------------------------------------------------------------
drop policy if exists "inscripciones_select_propio" on public.inscripciones;
create policy "inscripciones_select_propio" on public.inscripciones
  for select using (auth.uid() = id_usuario or private.es_administrador());

drop policy if exists "inscripciones_insert_propio" on public.inscripciones;
create policy "inscripciones_insert_propio" on public.inscripciones
  for insert with check (
    auth.uid() = id_usuario
    and tipo_acceso = 'MEMBRESIA'
    and otorgado_por is null
    and exists (
      select 1 from public.suscripciones
      where suscripciones.id_usuario = auth.uid()
        and suscripciones.estado in ('ACTIVA', 'PAST_DUE')
    )
  );

drop policy if exists "inscripciones_admin_gestiona" on public.inscripciones;
create policy "inscripciones_admin_gestiona" on public.inscripciones
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- RECURSOS_DESCARGABLES
-- Mismo criterio de acceso que el video de la lección a la que
-- pertenecen: inscripción vigente al curso, o suscripción activa/
-- past_due (ver docs/technical-spec.md §5, "Generación de Firmas Mux").
-- ------------------------------------------------------------
drop policy if exists "recursos_select_con_acceso" on public.recursos_descargables;
create policy "recursos_select_con_acceso" on public.recursos_descargables
  for select using (
    private.es_administrador()
    or exists (
      select 1 from public.lecciones
      join public.modulos on modulos.id = lecciones.id_modulo
      join public.cursos on cursos.id = modulos.id_curso
      where lecciones.id = recursos_descargables.id_leccion
        and (
          exists (
            select 1 from public.inscripciones
            where inscripciones.id_usuario = auth.uid()
              and inscripciones.id_curso = cursos.id
          )
          or exists (
            select 1 from public.suscripciones
            where suscripciones.id_usuario = auth.uid()
              and suscripciones.estado in ('ACTIVA', 'PAST_DUE')
          )
        )
    )
  );

drop policy if exists "recursos_admin_escritura" on public.recursos_descargables;
create policy "recursos_admin_escritura" on public.recursos_descargables
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- BITACORA_ADMINISTRATIVA
-- Exclusivo administrador, sin excepción (registro de auditoría).
-- ------------------------------------------------------------
drop policy if exists "bitacora_solo_admin" on public.bitacora_administrativa;
create policy "bitacora_solo_admin" on public.bitacora_administrativa
  for all using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------
-- EVENTOS_WEBHOOK
-- Sin ninguna policy, a propósito: esta tabla la usan exclusivamente
-- los endpoints /api/webhooks/* del backend con la Service Role Key
-- (que ignora RLS por completo). Con RLS activo (ya lo hizo
-- 001_rls_policies.sql) y cero políticas, queda 100% inaccesible para
-- los roles `anon` y `authenticated` — ni siquiera un administrador
-- logueado debe poder leerla vía PostgREST, porque contiene el
-- payload crudo de Stripe/Wompi/Mux. No es un olvido.
-- ------------------------------------------------------------
