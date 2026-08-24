-- ============================================================
-- Corrige un gap detectado en la re-verificación del checklist de
-- esquema: curso_categorias no tenía actualizado_en. A diferencia de
-- bitacora_administrativa (log append-only, sin actualizado_en a
-- propósito), curso_categorias SÍ se actualiza en el tiempo —
-- actualizarInfoCurso() hace upsert sobre ella al cambiar la
-- categoría de un curso — así que corresponde tener el par completo.
-- ============================================================

ALTER TABLE "curso_categorias" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_actualizado_en ON public.curso_categorias;
CREATE TRIGGER set_actualizado_en BEFORE UPDATE ON public.curso_categorias
  FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();
