-- ============================================================
-- Separa las políticas "FOR ALL" en SELECT/INSERT/UPDATE/DELETE
-- Ver auditoría de RLS (checklist de seguridad).
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-013.
--
-- Por qué: una política "for all" aplica la MISMA condición a las 4
-- operaciones sin distinción, lo que dificulta razonar/auditar qué
-- regla gobierna cada una (y a futuro, diferenciarlas si el negocio
-- lo pide, ej. permitir SELECT pero no DELETE). No cambia ningún
-- comportamiento: cada política de abajo tiene exactamente la misma
-- condición que la "for all" que reemplaza, solo separada por
-- operación.
--
-- Cubre las 13 políticas "for all" que existían hasta ahora:
-- cursos, modulos, lecciones, progreso, planes, suscripciones,
-- pagos, cupones, inscripciones, recursos_descargables,
-- bitacora_administrativa, categorias, instructores.
--
-- Idempotente: `drop policy if exists` antes de cada `create policy`,
-- mismo patrón que el resto de esta carpeta.
-- ============================================================

-- ------------------------------------------------------------
-- CURSOS (reemplaza cursos_admin_escritura, de 001)
-- ------------------------------------------------------------
drop policy if exists "cursos_admin_escritura" on public.cursos;

drop policy if exists "cursos_admin_insert" on public.cursos;
create policy "cursos_admin_insert" on public.cursos
  for insert with check (private.es_administrador());

drop policy if exists "cursos_admin_update" on public.cursos;
create policy "cursos_admin_update" on public.cursos
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "cursos_admin_delete" on public.cursos;
create policy "cursos_admin_delete" on public.cursos
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- MODULOS (reemplaza modulos_admin_escritura, de 001)
-- ------------------------------------------------------------
drop policy if exists "modulos_admin_escritura" on public.modulos;

drop policy if exists "modulos_admin_insert" on public.modulos;
create policy "modulos_admin_insert" on public.modulos
  for insert with check (private.es_administrador());

drop policy if exists "modulos_admin_update" on public.modulos;
create policy "modulos_admin_update" on public.modulos
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "modulos_admin_delete" on public.modulos;
create policy "modulos_admin_delete" on public.modulos
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- LECCIONES (reemplaza lecciones_admin_escritura, de 001)
-- ------------------------------------------------------------
drop policy if exists "lecciones_admin_escritura" on public.lecciones;

drop policy if exists "lecciones_admin_insert" on public.lecciones;
create policy "lecciones_admin_insert" on public.lecciones
  for insert with check (private.es_administrador());

drop policy if exists "lecciones_admin_update" on public.lecciones;
create policy "lecciones_admin_update" on public.lecciones
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "lecciones_admin_delete" on public.lecciones;
create policy "lecciones_admin_delete" on public.lecciones
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- PROGRESO (reemplaza progreso_propio, de 001 + 008)
-- El SELECT no llevaba condición de correo verificado (008 solo tocó
-- el with check de INSERT/UPDATE); se conserva esa misma asimetría.
-- ------------------------------------------------------------
drop policy if exists "progreso_propio" on public.progreso;

drop policy if exists "progreso_select_propio" on public.progreso;
create policy "progreso_select_propio" on public.progreso
  for select using (auth.uid() = id_usuario);

drop policy if exists "progreso_insert_propio" on public.progreso;
create policy "progreso_insert_propio" on public.progreso
  for insert with check (auth.uid() = id_usuario and private.correo_verificado());

drop policy if exists "progreso_update_propio" on public.progreso;
create policy "progreso_update_propio" on public.progreso
  for update using (auth.uid() = id_usuario)
  with check (auth.uid() = id_usuario and private.correo_verificado());

drop policy if exists "progreso_delete_propio" on public.progreso;
create policy "progreso_delete_propio" on public.progreso
  for delete using (auth.uid() = id_usuario);

-- ------------------------------------------------------------
-- PLANES (reemplaza planes_admin_escritura, de 003)
-- ------------------------------------------------------------
drop policy if exists "planes_admin_escritura" on public.planes;

drop policy if exists "planes_admin_insert" on public.planes;
create policy "planes_admin_insert" on public.planes
  for insert with check (private.es_administrador());

drop policy if exists "planes_admin_update" on public.planes;
create policy "planes_admin_update" on public.planes
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "planes_admin_delete" on public.planes;
create policy "planes_admin_delete" on public.planes
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- SUSCRIPCIONES (reemplaza suscripciones_admin_gestiona, de 003)
-- ------------------------------------------------------------
drop policy if exists "suscripciones_admin_gestiona" on public.suscripciones;

drop policy if exists "suscripciones_admin_insert" on public.suscripciones;
create policy "suscripciones_admin_insert" on public.suscripciones
  for insert with check (private.es_administrador());

drop policy if exists "suscripciones_admin_update" on public.suscripciones;
create policy "suscripciones_admin_update" on public.suscripciones
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "suscripciones_admin_delete" on public.suscripciones;
create policy "suscripciones_admin_delete" on public.suscripciones
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- PAGOS (reemplaza pagos_admin_gestiona, de 003)
-- ------------------------------------------------------------
drop policy if exists "pagos_admin_gestiona" on public.pagos;

drop policy if exists "pagos_admin_insert" on public.pagos;
create policy "pagos_admin_insert" on public.pagos
  for insert with check (private.es_administrador());

drop policy if exists "pagos_admin_update" on public.pagos;
create policy "pagos_admin_update" on public.pagos
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "pagos_admin_delete" on public.pagos;
create policy "pagos_admin_delete" on public.pagos
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- CUPONES (reemplaza cupones_admin_gestiona, de 003)
-- ------------------------------------------------------------
drop policy if exists "cupones_admin_gestiona" on public.cupones;

-- A diferencia de las demás tablas de este archivo, cupones no tenía
-- (ni tiene) una policy de SELECT separada: 003_rls_membresia_y_gestion.sql
-- la dejó fuera a propósito para anon/authenticated. El único SELECT que
-- existía venía del "for all" que este archivo reemplaza — se recrea
-- explícitamente para que el admin no pierda esa capacidad.
drop policy if exists "cupones_admin_select" on public.cupones;
create policy "cupones_admin_select" on public.cupones
  for select using (private.es_administrador());

drop policy if exists "cupones_admin_insert" on public.cupones;
create policy "cupones_admin_insert" on public.cupones
  for insert with check (private.es_administrador());

drop policy if exists "cupones_admin_update" on public.cupones;
create policy "cupones_admin_update" on public.cupones
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "cupones_admin_delete" on public.cupones;
create policy "cupones_admin_delete" on public.cupones
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- INSCRIPCIONES (reemplaza inscripciones_admin_gestiona, de 003)
-- No toca inscripciones_select_propio ni inscripciones_insert_propio
-- (esas ya eran políticas de una sola operación, no "for all").
-- ------------------------------------------------------------
drop policy if exists "inscripciones_admin_gestiona" on public.inscripciones;

drop policy if exists "inscripciones_admin_insert" on public.inscripciones;
create policy "inscripciones_admin_insert" on public.inscripciones
  for insert with check (private.es_administrador());

drop policy if exists "inscripciones_admin_update" on public.inscripciones;
create policy "inscripciones_admin_update" on public.inscripciones
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "inscripciones_admin_delete" on public.inscripciones;
create policy "inscripciones_admin_delete" on public.inscripciones
  for delete using (private.es_administrador());

-- Sin policy de SELECT propia aquí: inscripciones_select_propio (003)
-- ya cubre al admin con "auth.uid() = id_usuario or private.es_administrador()".

-- ------------------------------------------------------------
-- RECURSOS_DESCARGABLES (reemplaza recursos_admin_escritura, de 003)
-- ------------------------------------------------------------
drop policy if exists "recursos_admin_escritura" on public.recursos_descargables;

drop policy if exists "recursos_admin_insert" on public.recursos_descargables;
create policy "recursos_admin_insert" on public.recursos_descargables
  for insert with check (private.es_administrador());

drop policy if exists "recursos_admin_update" on public.recursos_descargables;
create policy "recursos_admin_update" on public.recursos_descargables
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "recursos_admin_delete" on public.recursos_descargables;
create policy "recursos_admin_delete" on public.recursos_descargables
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- BITACORA_ADMINISTRATIVA (reemplaza bitacora_solo_admin, de 003)
-- ------------------------------------------------------------
drop policy if exists "bitacora_solo_admin" on public.bitacora_administrativa;

drop policy if exists "bitacora_admin_select" on public.bitacora_administrativa;
create policy "bitacora_admin_select" on public.bitacora_administrativa
  for select using (private.es_administrador());

drop policy if exists "bitacora_admin_insert" on public.bitacora_administrativa;
create policy "bitacora_admin_insert" on public.bitacora_administrativa
  for insert with check (private.es_administrador());

drop policy if exists "bitacora_admin_update" on public.bitacora_administrativa;
create policy "bitacora_admin_update" on public.bitacora_administrativa
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "bitacora_admin_delete" on public.bitacora_administrativa;
create policy "bitacora_admin_delete" on public.bitacora_administrativa
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- CATEGORIAS (reemplaza categorias_admin_escritura, de 005)
-- No toca categorias_select_publico.
-- ------------------------------------------------------------
drop policy if exists "categorias_admin_escritura" on public.categorias;

drop policy if exists "categorias_admin_insert" on public.categorias;
create policy "categorias_admin_insert" on public.categorias
  for insert with check (private.es_administrador());

drop policy if exists "categorias_admin_update" on public.categorias;
create policy "categorias_admin_update" on public.categorias
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "categorias_admin_delete" on public.categorias;
create policy "categorias_admin_delete" on public.categorias
  for delete using (private.es_administrador());

-- ------------------------------------------------------------
-- INSTRUCTORES (reemplaza instructores_admin_escritura, de 006)
-- No toca instructores_select_publico.
-- ------------------------------------------------------------
drop policy if exists "instructores_admin_escritura" on public.instructores;

drop policy if exists "instructores_admin_insert" on public.instructores;
create policy "instructores_admin_insert" on public.instructores
  for insert with check (private.es_administrador());

drop policy if exists "instructores_admin_update" on public.instructores;
create policy "instructores_admin_update" on public.instructores
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "instructores_admin_delete" on public.instructores;
create policy "instructores_admin_delete" on public.instructores
  for delete using (private.es_administrador());
