-- ============================================================
-- Barrido de las tablas de rate limiting. Ver AUDIT-2026-09-04.md,
-- P1-2 (agravante de disponibilidad) y P3-4.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-062.
--
-- Las tres tablas de intentos acumulan una fila por clave y nadie las
-- vacía nunca. `limpiar_intentos_canjear_codigo` (023) existe, pero es
-- por usuario y solo corre tras un canje exitoso: no barre nada.
--
-- Cuánto importa esto cambió con el arreglo de P1-2. Mientras la IP salía
-- del primer valor de `x-forwarded-for`, la clave la elegía el cliente y
-- cada valor nuevo insertaba una fila: escritura ilimitada en la base
-- desde un endpoint anónimo. Con src/lib/clientIp.ts leyendo la cadena
-- desde la derecha, la clave vuelve a ser la IP real y el crecimiento
-- queda acotado a las IPs que de verdad visitan el sitio. Lo que queda es
-- higiene —filas que ya no significan nada y siguen ahí—, no contención
-- de un abuso.
--
-- El margen de un día es deliberadamente mucho mayor que la ventana más
-- larga (1 hora, el canje), para que la limpieza no dependa de esas
-- constantes si algún día cambian. La guarda de `bloqueado_hasta` es lo
-- que de verdad protege: borrar una fila con bloqueo vigente levantaría
-- el bloqueo, que es justo lo contrario de lo que hace esta función.
-- ============================================================

create or replace function public.limpiar_intentos_rate_limit()
returns table(tabla text, filas_borradas int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_margen interval := interval '1 day';
  v_check  int;
  v_cert   int;
  v_canje  int;
begin
  delete from private.intentos_check_email
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_check = row_count;

  delete from private.intentos_verificar_certificado
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_cert = row_count;

  delete from private.intentos_canjear_codigo
  where primer_intento < now() - v_margen
    and (bloqueado_hasta is null or bloqueado_hasta <= now());
  get diagnostics v_canje = row_count;

  return query
    select 'intentos_check_email'::text, v_check
    union all select 'intentos_verificar_certificado'::text, v_cert
    union all select 'intentos_canjear_codigo'::text, v_canje;
end;
$$;

-- Mismo patrón de permisos que 023 y 050: nunca invocable por el cliente,
-- solo por el backend con la Service Role Key. `from public` es lo que
-- importa — toda función nueva otorga EXECUTE a PUBLIC al crearse, y
-- anon/authenticated son miembros implícitos de PUBLIC.
revoke execute on function public.limpiar_intentos_rate_limit() from public, anon, authenticated;
grant execute on function public.limpiar_intentos_rate_limit() to service_role;

-- Sin índice sobre `primer_intento` a propósito: con la clave ya no
-- falsificable estas tablas se cuentan en cientos de filas, donde un seq
-- scan es más barato que mantener el índice. Si alguna vez crecen a
-- decenas de miles, ese es el momento de añadirlo, no antes.
