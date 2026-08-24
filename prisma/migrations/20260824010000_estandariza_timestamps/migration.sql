-- ============================================================
-- Bloque 1 de la auditoría de esquema: estandariza columnas de
-- auditoría (creado_en / actualizado_en) a timestamptz en todas las
-- tablas, y agrega el par donde faltaba.
--
-- Escrita a mano y aplicada con `prisma migrate deploy` (no
-- `migrate dev`) por el mismo motivo documentado en la migración
-- `instructores_como_entidad`: `perfiles.id` referencia `auth.users`
-- fuera de los esquemas que Prisma rastrea, y `migrate dev` falla al
-- introspectar (P4002).
--
-- No se tocan columnas de fecha con semántica de negocio
-- (fecha_vencimiento, fecha_inicio, fecha_renovacion, fecha_emision) —
-- solo las de auditoría created/updated.
-- ============================================================

-- ---------- perfiles ----------
ALTER TABLE "perfiles" RENAME COLUMN "fecha_registro" TO "creado_en";
ALTER TABLE "perfiles" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';
ALTER TABLE "perfiles" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- planes ----------
ALTER TABLE "planes" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "planes" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- suscripciones ----------
ALTER TABLE "suscripciones" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "suscripciones" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- pagos ----------
ALTER TABLE "pagos" RENAME COLUMN "fecha" TO "creado_en";
ALTER TABLE "pagos" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';
ALTER TABLE "pagos" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- categorias ----------
ALTER TABLE "categorias" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "categorias" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- instructores ----------
ALTER TABLE "instructores" RENAME COLUMN "fecha_creacion" TO "creado_en";
ALTER TABLE "instructores" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';
ALTER TABLE "instructores" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- cursos ----------
ALTER TABLE "cursos" RENAME COLUMN "fecha_creacion" TO "creado_en";
ALTER TABLE "cursos" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';
ALTER TABLE "cursos" RENAME COLUMN "fecha_edicion" TO "actualizado_en";
ALTER TABLE "cursos" ALTER COLUMN "actualizado_en" TYPE timestamptz USING "actualizado_en" AT TIME ZONE 'UTC';
-- `fecha_edicion` nunca tuvo DEFAULT (Prisma no lo genera para
-- @updatedAt), lo que dejaba `crearCurso` expuesto a un NOT NULL
-- violation si el insert no la incluía explícitamente. Se corrige aquí.
ALTER TABLE "cursos" ALTER COLUMN "actualizado_en" SET DEFAULT now();

-- ---------- modulos ----------
ALTER TABLE "modulos" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "modulos" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- lecciones ----------
ALTER TABLE "lecciones" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "lecciones" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- progreso ----------
ALTER TABLE "progreso" RENAME COLUMN "fecha_actualizacion" TO "actualizado_en";
ALTER TABLE "progreso" ALTER COLUMN "actualizado_en" TYPE timestamptz USING "actualizado_en" AT TIME ZONE 'UTC';
ALTER TABLE "progreso" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "progreso" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- certificados ----------
-- fecha_emision se conserva (semántica propia: fecha de emisión del
-- certificado), solo cambia de tipo. Se agrega actualizado_en.
ALTER TABLE "certificados" ALTER COLUMN "fecha_emision" TYPE timestamptz USING "fecha_emision" AT TIME ZONE 'UTC';
ALTER TABLE "certificados" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- codigos_invitacion ----------
ALTER TABLE "codigos_invitacion" RENAME COLUMN "fecha_creacion" TO "creado_en";
ALTER TABLE "codigos_invitacion" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';
ALTER TABLE "codigos_invitacion" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- cupones ----------
ALTER TABLE "cupones" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "cupones" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- inscripciones ----------
ALTER TABLE "inscripciones" ADD COLUMN "creado_en" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "inscripciones" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- bitacora_administrativa ----------
-- Log de solo-lectura: se renombra fecha -> creado_en, pero
-- deliberadamente NO se agrega actualizado_en (una fila de bitácora
-- nunca se edita después de creada).
ALTER TABLE "bitacora_administrativa" RENAME COLUMN "fecha" TO "creado_en";
ALTER TABLE "bitacora_administrativa" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';

-- ---------- eventos_webhook ----------
ALTER TABLE "eventos_webhook" RENAME COLUMN "fecha_recibida" TO "creado_en";
ALTER TABLE "eventos_webhook" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';
ALTER TABLE "eventos_webhook" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ---------- recursos_descargables ----------
ALTER TABLE "recursos_descargables" RENAME COLUMN "fecha_creacion" TO "creado_en";
ALTER TABLE "recursos_descargables" ALTER COLUMN "creado_en" TYPE timestamptz USING "creado_en" AT TIME ZONE 'UTC';
ALTER TABLE "recursos_descargables" ADD COLUMN "actualizado_en" timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- Trigger genérico que mantiene actualizado_en al día.
-- Vive en `private` (igual que private.handle_new_user() y
-- private.perfiles_bloquea_autopromocion()) porque solo lo invoca el
-- propio trigger de Postgres, nunca se llama vía RPC.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "private";

CREATE OR REPLACE FUNCTION "private"."actualiza_actualizado_en"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'perfiles', 'planes', 'suscripciones', 'pagos', 'categorias',
    'instructores', 'cursos', 'modulos', 'lecciones', 'progreso',
    'certificados', 'codigos_invitacion', 'cupones', 'inscripciones',
    'eventos_webhook', 'recursos_descargables'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_actualizado_en ON public.%I', tabla);
    EXECUTE format(
      'CREATE TRIGGER set_actualizado_en BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en()',
      tabla
    );
  END LOOP;
END;
$$;
