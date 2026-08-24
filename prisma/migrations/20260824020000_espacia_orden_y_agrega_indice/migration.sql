-- ============================================================
-- Bloque 2 de la auditoría de esquema: `orden` con separación
-- (10, 20, 30...) en vez de enteros consecutivos, para poder insertar
-- en medio sin reescribir toda la tabla. Reespacía los valores
-- existentes y agrega el índice compuesto que faltaba en `lecciones`.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo
-- que las migraciones anteriores (P4002 por el FK de perfiles hacia
-- auth.users).
-- ============================================================

-- ---------- modulos: reespacía por curso ----------
with reespaciado as (
  select id, row_number() over (partition by id_curso order by orden, id) as posicion
  from public.modulos
)
update public.modulos m
set orden = r.posicion * 10
from reespaciado r
where r.id = m.id;

-- ---------- lecciones: reespacía por módulo ----------
with reespaciado as (
  select id, row_number() over (partition by id_modulo order by orden, id) as posicion
  from public.lecciones
)
update public.lecciones l
set orden = r.posicion * 10
from reespaciado r
where r.id = l.id;

-- ---------- índice compuesto para listar lecciones ordenadas ----------
DROP INDEX IF EXISTS "lecciones_id_modulo_idx";
CREATE INDEX "lecciones_id_modulo_orden_idx" ON "lecciones"("id_modulo", "orden");
