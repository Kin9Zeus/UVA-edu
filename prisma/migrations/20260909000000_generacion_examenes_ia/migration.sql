-- ============================================================
-- Generación de exámenes con IA a partir de las transcripciones del curso
--
-- El examen ya era del CURSO antes de esta migración (`examenes.id_curso` es
-- UNIQUE desde 20260907020000_examenes_finales). Lo que faltaba era saber de
-- QUÉ VIDEO salió cada pregunta y poder demostrarlo: eso son las tres
-- columnas nuevas de `preguntas_examen`.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que las
-- anteriores (P4002 por el FK de perfiles hacia auth.users: la shadow database
-- de `prisma migrate dev` no tiene el esquema `auth`).
--
-- RLS vive en supabase/sql/083_generacion_examenes_ia.sql (npm run db:rls),
-- no acá.
--
-- Compatible hacia atrás (docs/ops/plan-de-reversion.md): solo agrega un tipo,
-- dos tablas y tres columnas NULLABLE. Ningún DROP ni RENAME, y ninguna
-- columna nueva es NOT NULL sin default — el código anterior al despliegue
-- sigue insertando en `preguntas_examen` exactamente igual.
-- ============================================================

CREATE TYPE "EstadoTrabajoGeneracionExamen" AS ENUM (
    'PENDIENTE',
    'COMPLETADO',
    'FALLIDO'
);

-- ------------------------------------------------------------
-- preguntas_examen: procedencia de la pregunta
--
-- Las tres NULLABLE y sin default: `null` en las tres es exactamente lo que
-- describe a las preguntas que ya existen, escritas a mano por un
-- administrador. Un DEFAULT false en `validada` habría marcado esas mismas
-- filas como "sin validar", que es lo contrario de la verdad.
-- ------------------------------------------------------------
ALTER TABLE "preguntas_examen"
    ADD COLUMN "id_leccion_origen" UUID,
    ADD COLUMN "fragmento_origen"  TEXT,
    ADD COLUMN "validada"          BOOLEAN;

-- SET NULL y no CASCADE: borrar una lección no puede llevarse por delante una
-- pregunta de un examen publicado. La pregunta pierde su procedencia (y queda
-- visible como tal en el panel), pero el examen sigue completo.
ALTER TABLE "preguntas_examen"
    ADD CONSTRAINT "preguntas_examen_id_leccion_origen_fkey"
    FOREIGN KEY ("id_leccion_origen") REFERENCES "lecciones"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "preguntas_examen_id_leccion_origen_idx"
    ON "preguntas_examen"("id_leccion_origen");

-- Una pregunta validada tiene que decir CONTRA QUÉ se validó. Sin esto,
-- `validada = true` con `fragmento_origen` nulo sería una afirmación que
-- nadie puede revisar — justo la clase de fila que este módulo existe para
-- evitar.
ALTER TABLE "preguntas_examen"
    ADD CONSTRAINT "preguntas_examen_validada_exige_origen"
    CHECK (
        "validada" IS NULL
        OR ("fragmento_origen" IS NOT NULL AND "id_leccion_origen" IS NOT NULL)
    );

-- ------------------------------------------------------------
-- transcripciones_video
-- ------------------------------------------------------------
CREATE TABLE "transcripciones_video" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "id_leccion"     UUID         NOT NULL,
    "id_curso"       UUID         NOT NULL,
    "id_asset_mux"   TEXT         NOT NULL,
    "id_track_mux"   TEXT         NOT NULL,
    "transcripcion"  TEXT         NOT NULL,
    "idioma"         TEXT         NOT NULL DEFAULT 'es',
    "creado_en"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "transcripciones_video_pkey" PRIMARY KEY ("id")
);

-- Una por lección: el webhook hace upsert sobre esta restricción, así que un
-- reemplazo de video pisa la transcripción vieja en vez de acumular dos.
CREATE UNIQUE INDEX "transcripciones_video_id_leccion_key"
    ON "transcripciones_video"("id_leccion");

CREATE INDEX "transcripciones_video_id_curso_idx"
    ON "transcripciones_video"("id_curso");

ALTER TABLE "transcripciones_video"
    ADD CONSTRAINT "transcripciones_video_id_leccion_fkey"
    FOREIGN KEY ("id_leccion") REFERENCES "lecciones"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transcripciones_video"
    ADD CONSTRAINT "transcripciones_video_id_curso_fkey"
    FOREIGN KEY ("id_curso") REFERENCES "cursos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- trabajos_generacion_examen
-- ------------------------------------------------------------
CREATE TABLE "trabajos_generacion_examen" (
    "id"                   UUID                            NOT NULL DEFAULT gen_random_uuid(),
    "id_curso"             UUID                            NOT NULL,
    "estado"               "EstadoTrabajoGeneracionExamen" NOT NULL DEFAULT 'PENDIENTE',
    "disparado_por"        TEXT                            NOT NULL,
    "preguntas_validadas"  INTEGER                         NOT NULL DEFAULT 0,
    "preguntas_recibidas"  INTEGER                         NOT NULL DEFAULT 0,
    "videos_sin_preguntas" TEXT[]                          NOT NULL DEFAULT ARRAY[]::TEXT[],
    "error"                TEXT,
    "finalizado_en"        TIMESTAMPTZ,
    "creado_en"            TIMESTAMPTZ                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en"       TIMESTAMPTZ                     NOT NULL,

    CONSTRAINT "trabajos_generacion_examen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trabajos_generacion_examen_id_curso_creado_en_idx"
    ON "trabajos_generacion_examen"("id_curso", "creado_en");

ALTER TABLE "trabajos_generacion_examen"
    ADD CONSTRAINT "trabajos_generacion_examen_id_curso_fkey"
    FOREIGN KEY ("id_curso") REFERENCES "cursos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- La idempotencia real, y por qué vive acá y no en TypeScript: dos
-- administradores que pulsan "generar examen" a la vez son dos procesos que
-- no se ven entre sí. Un `SELECT ... WHERE estado = 'PENDIENTE'` seguido de un
-- INSERT deja pasar los dos. Este índice hace que el segundo INSERT falle con
-- 23505 y que `crearTrabajoGeneracion()` lo lea como "ya hay uno corriendo".
--
-- Parcial a propósito: los trabajos COMPLETADO/FALLIDO son el historial del
-- curso y tienen que poder acumularse sin límite.
CREATE UNIQUE INDEX "trabajos_generacion_examen_uno_pendiente"
    ON "trabajos_generacion_examen"("id_curso")
    WHERE "estado" = 'PENDIENTE';

-- Los valores los define DISPARADORES_GENERACION en
-- src/lib/examenes/generacion/tipos.ts; el test
-- src/lib/examenes/generacion/tipos.test.ts falla si esta lista y aquella se
-- separan. Mismo patrón que el CHECK de `eventos_webhook.proveedor` (042).
ALTER TABLE "trabajos_generacion_examen"
    ADD CONSTRAINT "trabajos_generacion_examen_disparado_por_valido"
    CHECK ("disparado_por" IN ('ADMIN_MANUAL', 'VIDEO_AGREGADO'));

-- Un trabajo FALLIDO sin mensaje no le sirve a nadie para diagnosticar, y un
-- COMPLETADO con mensaje de error es una contradicción.
ALTER TABLE "trabajos_generacion_examen"
    ADD CONSTRAINT "trabajos_generacion_examen_error_solo_si_fallido"
    CHECK (
        ("estado" = 'FALLIDO' AND "error" IS NOT NULL)
        OR ("estado" <> 'FALLIDO' AND "error" IS NULL)
    );
