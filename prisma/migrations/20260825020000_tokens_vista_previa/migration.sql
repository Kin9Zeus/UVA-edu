-- ============================================================
-- Enlaces temporales de vista previa (Revcurso, requisito 3).
--
-- Permiten abrir un curso en BORRADOR sin tener cuenta: el admin genera un
-- enlace y se lo pasa al cliente o al instructor para que revise antes de
-- publicar.
--
-- Por qué se guarda el HASH y no el token
-- ---------------------------------------
-- La columna guarda SHA-256 del token, nunca el token en claro — mismo
-- criterio que una contraseña. Un volcado de la base, o cualquiera con
-- lectura sobre esta tabla, obtendría hashes inservibles en vez de enlaces
-- que abren contenido no publicado. El token en claro existe una sola vez:
-- en la respuesta del Server Action que lo crea, para mostrarlo y copiarlo.
-- Si se pierde, no se recupera: se genera otro.
--
-- Caducidad obligatoria
-- ---------------------
-- `expira_en` es NOT NULL a propósito: no existe el enlace de vista previa
-- permanente. Un borrador es material interno y un enlace que no caduca
-- termina circulando indefinidamente. `revocado_en` permite además cortarlo
-- antes de tiempo si se compartió por error.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- las migraciones anteriores (P4002 por el FK de perfiles hacia auth.users).
-- ============================================================

CREATE TABLE "tokens_vista_previa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "id_curso" UUID NOT NULL,
    "id_admin_creador" UUID,
    "expira_en" timestamptz NOT NULL,
    "revocado_en" timestamptz,
    "veces_usado" INTEGER NOT NULL DEFAULT 0,
    "creado_en" timestamptz NOT NULL DEFAULT now(),
    "actualizado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "tokens_vista_previa_pkey" PRIMARY KEY ("id")
);

-- La búsqueda al abrir el enlace es siempre por hash: además de garantizar
-- unicidad, este índice es el que la resuelve.
CREATE UNIQUE INDEX "tokens_vista_previa_token_hash_key"
    ON "tokens_vista_previa"("token_hash");

-- Para listar y revocar los enlaces de un curso desde el panel.
CREATE INDEX "tokens_vista_previa_id_curso_idx"
    ON "tokens_vista_previa"("id_curso");

-- CASCADE: si el curso se borra, sus enlaces de vista previa dejan de tener
-- sentido — no hay nada que previsualizar.
ALTER TABLE "tokens_vista_previa" ADD CONSTRAINT "tokens_vista_previa_id_curso_fkey"
    FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nullable + SET NULL, mismo criterio que categorias/instructores.id_admin_creador:
-- borrar al administrador no debe arrastrar el enlace ni bloquear el borrado.
ALTER TABLE "tokens_vista_previa" ADD CONSTRAINT "tokens_vista_previa_id_admin_creador_fkey"
    FOREIGN KEY ("id_admin_creador") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mismo trigger genérico que el resto de tablas (ver la migración
-- 20260824010000_estandariza_timestamps).
DROP TRIGGER IF EXISTS set_actualizado_en ON public.tokens_vista_previa;
CREATE TRIGGER set_actualizado_en
    BEFORE UPDATE ON public.tokens_vista_previa
    FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();
