-- ============================================================
-- Agrega `pais` a perfiles
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-059.
--
-- El formulario "Mi perfil" tenía un campo País suelto que nunca se leía
-- ni se guardaba (actions/perfil/actualizar.ts no lo tocaba). Ahora se
-- deriva del selector de indicativo telefónico (src/lib/paises.ts) y sí se
-- persiste. Columna simple, sin policy nueva: RLS en `perfiles` es por
-- fila (perfiles_update_propio, 057), no por columna, así que ya cubre
-- este campo igual que cubre `celular`.
-- ============================================================

alter table public.perfiles add column if not exists pais text;
