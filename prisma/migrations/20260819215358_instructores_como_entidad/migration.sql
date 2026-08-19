-- Instructores pasan de texto libre a entidad propia.
--
-- Escrita a mano, no generada por `prisma migrate dev`: el diff automático
-- produciría `DROP COLUMN "instructor"` + `ADD COLUMN "id_instructor" UUID
-- NOT NULL`, que sobre una tabla con filas falla y además pierde los
-- nombres ya capturados. En su lugar va el patrón expand → backfill →
-- link → contract, que conserva los datos.
--
-- Aplicar con `prisma migrate deploy` (no usa shadow database; `migrate
-- dev` intentaría crearla en Supabase y falla por permisos).

-- ── EXPAND ───────────────────────────────────────────────────────────
CREATE TABLE "instructores" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre"           TEXT NOT NULL,
    "especialidad"     TEXT,
    "id_admin_creador" UUID,
    "fecha_creacion"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructores_pkey" PRIMARY KEY ("id")
);

-- El formulario de curso permite dar de alta un instructor sin salir de la
-- pantalla; sin unicidad se acumularían duplicados del mismo nombre.
CREATE UNIQUE INDEX "instructores_nombre_key" ON "instructores"("nombre");

-- Mismo criterio que categorias.id_admin_creador: nullable con SET NULL,
-- para que borrar un administrador no quede bloqueado por su catálogo.
ALTER TABLE "instructores" ADD CONSTRAINT "instructores_id_admin_creador_fkey"
    FOREIGN KEY ("id_admin_creador") REFERENCES "perfiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Nullable de momento: se rellena en el backfill y se endurece al final.
ALTER TABLE "cursos" ADD COLUMN "id_instructor" UUID;

-- ── BACKFILL ─────────────────────────────────────────────────────────
-- Un instructor por cada nombre distinto que exista hoy en cursos. El
-- admin creador se hereda del curso más antiguo que lo menciona, para no
-- inventar autoría. `especialidad` queda NULL: no hay de dónde deducirla,
-- la completa el admin desde /admin/instructores.
INSERT INTO "instructores" ("nombre", "id_admin_creador")
SELECT DISTINCT ON (btrim(c."instructor"))
       btrim(c."instructor"),
       c."id_admin_creador"
FROM "cursos" c
WHERE btrim(coalesce(c."instructor", '')) <> ''
ORDER BY btrim(c."instructor"), c."fecha_creacion";

-- ── LINK ─────────────────────────────────────────────────────────────
UPDATE "cursos" c
SET "id_instructor" = i."id"
FROM "instructores" i
WHERE btrim(c."instructor") = i."nombre";

-- ── CONTRACT ─────────────────────────────────────────────────────────
-- Si algún curso quedó sin enlazar (instructor vacío), este SET NOT NULL
-- aborta la transacción entera a propósito: mejor fallar aquí que dejar
-- el catálogo a medias.
ALTER TABLE "cursos" ALTER COLUMN "id_instructor" SET NOT NULL;

ALTER TABLE "cursos" DROP COLUMN "instructor";

ALTER TABLE "cursos" ADD CONSTRAINT "cursos_id_instructor_fkey"
    FOREIGN KEY ("id_instructor") REFERENCES "instructores"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Postgres no indexa las Foreign Keys por su cuenta.
CREATE INDEX "cursos_id_instructor_idx" ON "cursos"("id_instructor");
