-- ============================================================
-- Exámenes finales por curso (docs/functional-spec.md Flujo 14)
--
-- Un curso puede exigir aprobar un examen final antes de considerarse
-- completo y emitir certificado. Quien crea el curso decide si lo necesita:
-- sin fila en `examenes` (o con `publicado = false`) la certificación
-- funciona exactamente como antes de esta migración — 100% de lecciones y
-- listo. La regla vive en `private.curso_esta_completo`
-- (supabase/sql/067_certificado_requiere_examen.sql), no acá.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- las migraciones anteriores (P4002 por el FK de perfiles hacia auth.users:
-- la shadow database de `prisma migrate dev` no tiene ese esquema).
--
-- RLS vive en supabase/sql/066_examenes.sql (npm run db:rls), no acá.
--
-- Compatible hacia atrás (docs/ops/plan-de-reversion.md): solo agrega tipos
-- y tablas nuevas. Ningún DROP ni RENAME — el código anterior al despliegue
-- sigue funcionando con estas tablas presentes y vacías.
-- ============================================================

-- Los siete tipos del diseño, aunque la app v1 solo acepte los cuatro
-- primeros: `ALTER TYPE ... ADD VALUE` no puede correr en la misma
-- transacción que lo usa, así que declararlos ahora ahorra una migración de
-- tipo cuando llegue la Fase 2 (ver el comentario de `TipoPregunta` en
-- prisma/schema.prisma).
CREATE TYPE "TipoPregunta" AS ENUM (
    'OPCION_UNICA',
    'OPCION_MULTIPLE',
    'VERDADERO_FALSO',
    'RELLENAR_ESPACIO',
    'ORDENAR_PASOS',
    'EMPAREJAR',
    'RESPUESTA_ABIERTA'
);

CREATE TYPE "EstadoIntentoExamen" AS ENUM (
    'EN_CURSO',
    'APROBADO',
    'REPROBADO',
    'EN_REVISION'
);

-- ------------------------------------------------------------
-- examenes
-- ------------------------------------------------------------
CREATE TABLE "examenes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_curso" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "instrucciones" JSONB,
    "nota_aprobatoria" INTEGER NOT NULL DEFAULT 75,
    "intentos_maximos" INTEGER DEFAULT 3,
    "minutos_limite" INTEGER,
    "aleatorizar_preguntas" BOOLEAN NOT NULL DEFAULT true,
    "aleatorizar_opciones" BOOLEAN NOT NULL DEFAULT true,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" timestamptz NOT NULL DEFAULT now(),
    "actualizado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "examenes_pkey" PRIMARY KEY ("id")
);

-- Un solo examen final por curso. Es también lo que hace barata la consulta
-- "¿este curso exige examen?" que corre en cada guardado de progreso.
CREATE UNIQUE INDEX "examenes_id_curso_key" ON "examenes"("id_curso");

ALTER TABLE "examenes" ADD CONSTRAINT "examenes_id_curso_fkey"
    FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El 75% es regla de negocio, no un default de formulario: el admin puede
-- exigir más, nunca menos. En la base y no solo en el Server Action porque
-- `examenes` tiene política de UPDATE para administradores — un PATCH
-- directo contra PostgREST se saltaría cualquier validación de la app.
ALTER TABLE "examenes" ADD CONSTRAINT "examenes_nota_aprobatoria_minima"
    CHECK ("nota_aprobatoria" >= 75 AND "nota_aprobatoria" <= 100);

ALTER TABLE "examenes" ADD CONSTRAINT "examenes_intentos_maximos_positivo"
    CHECK ("intentos_maximos" IS NULL OR "intentos_maximos" >= 1);

ALTER TABLE "examenes" ADD CONSTRAINT "examenes_minutos_limite_positivo"
    CHECK ("minutos_limite" IS NULL OR ("minutos_limite" >= 1 AND "minutos_limite" <= 1440));

-- ------------------------------------------------------------
-- preguntas_examen
-- ------------------------------------------------------------
CREATE TABLE "preguntas_examen" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_examen" UUID NOT NULL,
    "tipo" "TipoPregunta" NOT NULL,
    "enunciado" JSONB NOT NULL,
    "puntos" INTEGER NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "opciones" JSONB,
    "respuestas_aceptadas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "explicacion" JSONB,
    "creado_en" timestamptz NOT NULL DEFAULT now(),
    "actualizado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "preguntas_examen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "preguntas_examen_id_examen_orden_idx" ON "preguntas_examen"("id_examen", "orden");

ALTER TABLE "preguntas_examen" ADD CONSTRAINT "preguntas_examen_id_examen_fkey"
    FOREIGN KEY ("id_examen") REFERENCES "examenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una pregunta que vale 0 puntos no aporta al puntaje pero sí ocupa lugar en
-- el examen: es siempre un error de captura, no una decisión.
ALTER TABLE "preguntas_examen" ADD CONSTRAINT "preguntas_examen_puntos_positivo"
    CHECK ("puntos" >= 1 AND "puntos" <= 100);

-- ------------------------------------------------------------
-- intentos_examen
-- ------------------------------------------------------------
CREATE TABLE "intentos_examen" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_examen" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "estado" "EstadoIntentoExamen" NOT NULL DEFAULT 'EN_CURSO',
    "puntaje_pct" DECIMAL(5,2),
    "nota_requerida" INTEGER NOT NULL,
    "preguntas_congeladas" JSONB NOT NULL,
    "respuestas" JSONB NOT NULL DEFAULT '{}',
    "iniciado_en" timestamptz NOT NULL DEFAULT now(),
    "finalizado_en" timestamptz,
    "expira_en" timestamptz,
    "creado_en" timestamptz NOT NULL DEFAULT now(),
    "actualizado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "intentos_examen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "intentos_examen_id_usuario_id_examen_idx"
    ON "intentos_examen"("id_usuario", "id_examen");

CREATE INDEX "intentos_examen_id_examen_idx" ON "intentos_examen"("id_examen");

ALTER TABLE "intentos_examen" ADD CONSTRAINT "intentos_examen_id_examen_fkey"
    FOREIGN KEY ("id_examen") REFERENCES "examenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT y no CASCADE: un intento es la evidencia de que el estudiante
-- rindió. Mismo criterio que `certificados.id_usuario` — borrar un perfil no
-- debe borrar en silencio el rastro de su evaluación.
ALTER TABLE "intentos_examen" ADD CONSTRAINT "intentos_examen_id_usuario_fkey"
    FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un solo intento abierto por estudiante y examen. Sin esto, dos pestañas (o
-- dos clics rápidos en "Iniciar examen") crean dos intentos EN_CURSO y el
-- estudiante consume dos de sus tres oportunidades sin haberlo pedido; peor,
-- podría abrir varios para ver distintas aleatorizaciones del mismo examen y
-- quedarse con la que más le convenga. Es un índice parcial porque los
-- intentos ya finalizados sí pueden ser muchos.
CREATE UNIQUE INDEX "intentos_examen_uno_en_curso"
    ON "intentos_examen"("id_usuario", "id_examen")
    WHERE "estado" = 'EN_CURSO';

-- El puntaje solo tiene sentido en un intento ya cerrado, y siempre en 0-100.
ALTER TABLE "intentos_examen" ADD CONSTRAINT "intentos_examen_puntaje_rango"
    CHECK ("puntaje_pct" IS NULL OR ("puntaje_pct" >= 0 AND "puntaje_pct" <= 100));

ALTER TABLE "intentos_examen" ADD CONSTRAINT "intentos_examen_cerrado_tiene_puntaje"
    CHECK (
        ("estado" = 'EN_CURSO' AND "puntaje_pct" IS NULL AND "finalizado_en" IS NULL)
        OR ("estado" = 'EN_REVISION' AND "finalizado_en" IS NOT NULL)
        OR ("estado" IN ('APROBADO', 'REPROBADO') AND "puntaje_pct" IS NOT NULL AND "finalizado_en" IS NOT NULL)
    );
