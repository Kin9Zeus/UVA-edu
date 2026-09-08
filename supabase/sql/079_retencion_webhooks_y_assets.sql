-- ============================================================
-- Retención de eventos de webhook y de la cola de assets de Mux
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-12 (P3).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-078.
--
-- Dos tablas que crecen para siempre y que nadie limpia:
--
--   eventos_webhook  — guarda el `payload` jsonb COMPLETO de Stripe, Wompi y
--                      Mux. El de una pasarela de pagos trae, según el
--                      evento, correo del pagador, los cuatro últimos
--                      dígitos de la tarjeta, dirección de facturación y el
--                      identificador del cliente en el proveedor. Es la
--                      tabla con más datos personales de terceros del
--                      esquema, y hoy no tiene fecha de caducidad.
--
--   mux_assets_pendientes_eliminacion — una cola de trabajo. Las filas ya
--                      procesadas (`eliminado = true`) no sirven para nada
--                      más que para depurar el borrado reciente.
--
-- Por qué 90 y 30 días
-- --------------------
-- 90 para los webhooks porque la razón de conservarlos es poder reconstruir
-- una disputa de cobro o un asset que no llegó, y ese plazo cubre con margen
-- la ventana de contracargo típica. La UNIQUE (proveedor, id_evento_externo)
-- que da la idempotencia sigue protegiendo lo que importa: un proveedor no
-- reenvía un evento de hace tres meses, y si lo hiciera, reprocesarlo sería
-- lo correcto, no un duplicado.
--
-- 30 para la cola de Mux, y solo filas ya eliminadas: una fila con
-- `eliminado = false` es trabajo pendiente y no se toca por vieja que sea —
-- borrarla dejaría un asset huérfano pagándose en Mux para siempre, que es
-- justo el problema que la tabla existe para evitar (P1-5, AUDIT-2026-08-26).
--
-- Se conserva un evento no procesado sin importar su antigüedad, por lo
-- mismo: es un fallo sin resolver, no un registro histórico.
-- ============================================================

create or replace function private.purgar_eventos_webhook()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.eventos_webhook
  where procesado = true
    and creado_en < now() - interval '90 days';
$$;

create or replace function private.purgar_cola_assets_mux()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.mux_assets_pendientes_eliminacion
  where eliminado = true
    and eliminado_en is not null
    and eliminado_en < now() - interval '30 days';
$$;

-- Una sola entrada por trabajo programado. pg_cron acepta varias sentencias
-- en el mismo comando, pero entonces el fallo de la primera deja la segunda
-- sin correr y `cron.job_run_details` guarda un único resultado para las dos:
-- se pierde de vista cuál falló. Con una función envolvente el trabajo es
-- una llamada, y las dos purgas comparten transacción.
create or replace function private.purgar_retencion_diaria()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform private.purgar_eventos_webhook();
  perform private.purgar_cola_assets_mux();
end;
$$;

create extension if not exists pg_cron;

-- 03:45, después de limpiar-rate-limit (03:30). Mismo escalonado de 026 y
-- 073 para no solapar trabajos de mantenimiento.
select cron.unschedule(jobid)
from cron.job
where jobname = 'purgar-webhooks-y-assets';

select cron.schedule(
  'purgar-webhooks-y-assets',
  '45 3 * * *',
  $$select private.purgar_retencion_diaria();$$
);
