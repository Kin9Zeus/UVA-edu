-- ============================================================
-- RLS activada en las tablas de rate limit de `private`.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-117.
--
-- Por qué
-- -------
-- En producción, 5 de estas tablas (009, 022, 023) tenían RLS activada a
-- mano desde el panel de Supabase, sin script en el repo; staging y las 3
-- más nuevas (050, 106, 107) la tenían apagada. Se detectó comparando
-- staging con producción el 2026-10-02. Este script deja las 8 iguales y
-- versionadas.
--
-- Por qué no rompe nada
-- ---------------------
-- Sin políticas, RLS niega todo a quien no sea dueño de la tabla o tenga
-- BYPASSRLS. Las únicas que tocan estas tablas son funciones SECURITY
-- DEFINER del dueño (que se salta la RLS mientras no se use FORCE), y el
-- esquema `private` no se expone por la API. Es defensa en profundidad: si
-- algún día alguien concede un GRANT por error, la tabla sigue cerrada.
--
-- Idempotente: activar RLS ya activada no hace nada.
-- ============================================================

alter table private.verificacion_reenvios enable row level security;
alter table private.intentos_login enable row level security;
alter table private.recuperacion_reenvios enable row level security;
alter table private.intentos_check_email enable row level security;
alter table private.intentos_canjear_codigo enable row level security;
alter table private.intentos_verificar_certificado enable row level security;
alter table private.intentos_validar_cupon enable row level security;
alter table private.intentos_generar_examen enable row level security;
