-- ============================================================
-- Purga automática de las tablas de rate limit
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-9 (P2).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-072.
--
-- El schema `private` guarda seis tablas de control de abuso, y todas
-- contienen datos personales bajo la Ley 1581:
--
--   intentos_login                   (clave: correo)
--   intentos_check_email             (clave: IP)
--   intentos_verificar_certificado   (clave: IP)
--   recuperacion_reenvios            (clave: correo)
--   verificacion_reenvios            (clave: correo)
--   intentos_canjear_codigo          (clave: id de usuario)
--
-- `public.limpiar_intentos_rate_limit()` ya existe (063) y el comando
-- `npm run rate-limit:limpiar` la invoca. Lo que faltaba es que se ejecutara
-- sola: `cron.job` tenía exactamente dos entradas —limpiar-usuarios-no-verificados
-- (03:00) y purgar-tokens-vista-previa (03:15)— y ninguna era esta. La
-- retención de esos correos e IP dependía de que alguien se acordara.
--
-- Un dato personal que se conserva "hasta que alguien lo borre a mano" no
-- tiene política de retención: tiene una intención de retención.
--
-- 03:30, un cuarto de hora después de purgar-tokens-vista-previa, siguiendo
-- el mismo escalonado de 026 para no solapar trabajos de mantenimiento.
-- ============================================================

create extension if not exists pg_cron;

-- cron.schedule() no acepta "or replace"; se desprograma primero por si este
-- script se vuelve a correr (mismo criterio idempotente que 010 y 026).
select cron.unschedule(jobid)
from cron.job
where jobname = 'limpiar-rate-limit';

select cron.schedule(
  'limpiar-rate-limit',
  '30 3 * * *',
  $$select public.limpiar_intentos_rate_limit();$$
);
