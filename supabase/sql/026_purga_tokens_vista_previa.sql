-- ============================================================
-- Purga de enlaces de vista previa muertos
-- Ver 025_rls_tokens_vista_previa.sql y la migración de Prisma
-- 20260825020000_tokens_vista_previa.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 025.
--
-- Qué borra y qué NO
-- ------------------
-- Solo filas que YA no abren nada: caducadas o anuladas hace más de un
-- día. Un enlace vigente jamás se toca, ni siquiera uno de 7 días: la
-- condición mira `expira_en`/`revocado_en`, no `creado_en`.
--
-- El día de gracia existe para que quede margen de revisar la bitácora
-- después de anular un enlace que se compartió por error. Pasado eso, la
-- fila no aporta: la acción de generarlo y la de anularlo ya quedaron
-- registradas en `bitacora_administrativa`, que es el rastro duradero.
--
-- Por qué el DELETE aquí sí es posible
-- ------------------------------------
-- 025 a propósito no define policy de DELETE, así que ni un administrador
-- puede borrar estas filas vía PostgREST. Esta función puede porque es
-- SECURITY DEFINER y vive en `private`: solo la invoca el cron.schedule de
-- abajo, nunca un caller externo. La regla de "no se borra a mano" sigue
-- intacta; lo que se añade es una caducidad automática.
-- ============================================================

create or replace function private.purgar_tokens_vista_previa()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tokens_vista_previa
  where (expira_en < now() - interval '1 day')
     or (revocado_en is not null and revocado_en < now() - interval '1 day');
end;
$$;

create extension if not exists pg_cron;

-- cron.schedule() no acepta "or replace"; se desprograma primero por si
-- este script se vuelve a correr (mismo criterio idempotente que el resto
-- de esta carpeta, y que 010_fk_perfiles_cascade_y_limpieza.sql).
select cron.unschedule(jobid)
from cron.job
where jobname = 'purgar-tokens-vista-previa';

-- 03:15, un cuarto de hora después de limpiar-usuarios-no-verificados
-- (03:00), para no solapar dos trabajos de mantenimiento.
select cron.schedule(
  'purgar-tokens-vista-previa',
  '15 3 * * *',
  $$select private.purgar_tokens_vista_previa();$$
);
