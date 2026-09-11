-- ============================================================
-- Repara `actualizado_en` en las dos tablas que creó la migración
-- `20260909000000_generacion_examenes_ia`.
--
-- QUÉ ESTABA MAL
-- --------------
-- Ambas tablas declararon `actualizado_en TIMESTAMPTZ NOT NULL` sin
-- DEFAULT y sin el trigger `set_actualizado_en`. En schema.prisma la
-- columna lleva `@updatedAt`, pero eso es una función del CLIENTE de
-- Prisma — y este proyecto no usa Prisma en tiempo de ejecución: el CRUD
-- va por @supabase/supabase-js (CLAUDE.md §2). Así que el valor no lo
-- ponía nadie y todo INSERT que no lo escribiera a mano moría con:
--
--   null value in column "actualizado_en" of relation
--   "trabajos_generacion_examen" violates not-null constraint
--
-- Es exactamente lo que resolvió en su día la migración
-- `20260824010000_estandariza_timestamps` para las 16 tablas de
-- entonces, y lo que `20260825020000_tokens_vista_previa` copió al crear
-- una tabla nueva. La 083 se saltó las dos mitades del patrón.
--
-- POR QUÉ NO SE VIO ANTES
-- -----------------------
-- Las transcripciones sí se guardaban porque el webhook de Mux
-- (src/app/api/webhooks/mux/route.ts) escribe `actualizado_en` a mano en
-- su upsert. Eso tapó la ausencia del DEFAULT en `transcripciones_video`
-- y dejó el fallo esperando en la otra tabla, que es la que escribe el
-- panel al pulsar "Generar examen".
--
-- Las pruebas tampoco lo cazaron porque los INSERT de la sesión 083 en
-- scripts/rls-test.ts pasaban `actualizado_en` explícito, compensando el
-- error en vez de exponerlo. Se les quita en este mismo cambio.
--
-- Aditiva y reejecutable: no toca datos ni reescribe filas existentes.
-- ============================================================

-- ---------- DEFAULT: cubre el INSERT ----------
ALTER TABLE "transcripciones_video"
    ALTER COLUMN "actualizado_en" SET DEFAULT now();

ALTER TABLE "trabajos_generacion_examen"
    ALTER COLUMN "actualizado_en" SET DEFAULT now();

-- ---------- Trigger: cubre el UPDATE ----------
-- El DEFAULT solo actúa al insertar; sin esto, `actualizado_en` se
-- quedaría congelado en la fecha de creación y mentiría justo en la
-- tabla que registra cuándo terminó cada generación.
--
-- `private.actualiza_actualizado_en()` ya existe desde
-- `20260824010000_estandariza_timestamps`; aquí solo se enganchan las
-- dos tablas nuevas.
DROP TRIGGER IF EXISTS set_actualizado_en ON public.transcripciones_video;
CREATE TRIGGER set_actualizado_en
    BEFORE UPDATE ON public.transcripciones_video
    FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();

DROP TRIGGER IF EXISTS set_actualizado_en ON public.trabajos_generacion_examen;
CREATE TRIGGER set_actualizado_en
    BEFORE UPDATE ON public.trabajos_generacion_examen
    FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();
