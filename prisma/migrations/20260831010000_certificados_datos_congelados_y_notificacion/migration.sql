-- Certificados: datos congelados al momento de la emisión + notificación
-- pendiente (Deteccion.md, Fase 5 — requisitos de calidad senior):
--   "Guardar en el certificado los datos congelados al momento de la
--   emisión: nombre del estudiante, nombre del curso, fecha. Si el curso
--   se renombra después, el certificado no debe cambiar."
--   "La emisión no puede bloquear la interfaz: procesar de forma
--   asíncrona y notificar cuando esté listo."
--
-- Hasta esta migración `certificados` no guardaba nombre_estudiante ni
-- nombre_curso: tanto verificar_certificado() (supabase/sql/015) como
-- descargarCertificadoPdf (src/actions/certificados/descargar.ts) hacían
-- JOIN en vivo contra perfiles/cursos, así que corregir el nombre de un
-- perfil o renombrar un curso cambiaba certificados ya expedidos — viola
-- el requisito de integridad de un documento ya emitido. Ver
-- supabase/sql/047 y 015 (editados junto con esta migración) para el lado
-- de lectura/escritura.
--
-- notificado_en es el campo de outbox que consume
-- scripts/certificados-enviar-notificaciones.ts: NULL = correo de
-- "certificado listo" pendiente de enviar, timestamp = ya enviado.

-- Nullable primero: ya existen certificados emitidos (seed y cualquier
-- curso completado en desarrollo/staging) sin estos datos. Se
-- backfillean abajo antes de exigir NOT NULL — mismo patrón
-- expand/backfill/contract que el resto de columnas NOT NULL agregadas
-- después del `init` (ver 20260824010000_estandariza_timestamps).
ALTER TABLE "certificados" ADD COLUMN "nombre_estudiante" TEXT;
ALTER TABLE "certificados" ADD COLUMN "nombre_curso" TEXT;
ALTER TABLE "certificados" ADD COLUMN "notificado_en" TIMESTAMPTZ;

-- Backfill: snapshot del nombre/curso actuales para los certificados que
-- ya existen. Es la mejor aproximación posible retroactivamente — antes de
-- esta migración esos datos nunca se guardaron, así que no hay forma de
-- recuperar el nombre/título exactos del momento real de emisión.
UPDATE "certificados" c
SET "nombre_estudiante" = p."nombre",
    "nombre_curso" = cu."titulo"
FROM "perfiles" p, "cursos" cu
WHERE p."id" = c."id_usuario"
  AND cu."id" = c."id_curso"
  AND c."nombre_estudiante" IS NULL;

-- Certificados emitidos antes de que existiera la notificación por correo
-- no deben disparar un envío retroactivo en la primera corrida del
-- script: se marcan como ya notificados con su propia fecha de emisión.
UPDATE "certificados"
SET "notificado_en" = "fecha_emision"
WHERE "notificado_en" IS NULL;

ALTER TABLE "certificados" ALTER COLUMN "nombre_estudiante" SET NOT NULL;
ALTER TABLE "certificados" ALTER COLUMN "nombre_curso" SET NOT NULL;
