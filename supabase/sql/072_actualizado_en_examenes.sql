-- ============================================================
-- Trigger `actualizado_en` en las tablas de exámenes
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-8 (P2).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-071.
--
-- `examenes`, `preguntas_examen` e `intentos_examen` tienen la columna
-- `actualizado_en timestamptz not null default now()` como el resto del
-- esquema, pero 067_examenes.sql no les creó el trigger que la mantiene. Se
-- comprobó contra pg_trigger: las otras 22 tablas con esa columna sí lo
-- tienen; estas tres son las únicas sin él.
--
-- El efecto es silencioso, que es lo que lo hace molesto: `actualizado_en`
-- se queda congelada en la fecha de creación. Cualquier lógica futura de
-- "modificado desde" —sincronización incremental, invalidación de caché,
-- depuración por fecha, un informe de qué exámenes se tocaron esta semana—
-- da un resultado incorrecto sin fallar. Es el peor tipo de dato malo: uno
-- que parece bueno.
--
-- private.actualiza_actualizado_en() ya existe (024, con search_path fijo).
-- ============================================================

drop trigger if exists set_actualizado_en on public.examenes;
create trigger set_actualizado_en
  before update on public.examenes
  for each row execute function private.actualiza_actualizado_en();

drop trigger if exists set_actualizado_en on public.preguntas_examen;
create trigger set_actualizado_en
  before update on public.preguntas_examen
  for each row execute function private.actualiza_actualizado_en();

-- `intentos_examen` la actualiza hoy la propia lógica de calificación al
-- cerrar el intento, pero solo en ese camino: un cambio de estado hecho por
-- un administrador, o cualquier UPDATE futuro, la dejaría sin tocar. El
-- trigger la vuelve incondicional.
drop trigger if exists set_actualizado_en on public.intentos_examen;
create trigger set_actualizado_en
  before update on public.intentos_examen
  for each row execute function private.actualiza_actualizado_en();
