-- ============================================================
-- crear_lote_codigos_invitacion(): generación masiva en una sola transacción
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 044 y de
-- aplicar la migración de Prisma 20260831000000_lotes_codigos_invitacion.
--
-- Por qué un RPC y no dos inserts desde el Server Action
-- --------------------------------------------------------------
-- El requisito de rev.md es "la generación en lote es una sola transacción:
-- si falla a la mitad, no deben quedar códigos sueltos". Un Server Action
-- que hiciera `insert lote` y luego `insert codigos[]` como dos llamadas
-- independientes de supabase-js dejaría exactamente ese hueco: si el
-- segundo insert falla (por ejemplo, colisión de unicidad en `codigo`), el
-- lote ya habría quedado creado sin ningún código adentro. Envolver ambos
-- inserts en el cuerpo de una función PL/pgSQL los ejecuta dentro de la
-- misma transacción implícita de la llamada al RPC: si el segundo insert
-- lanza una excepción, Postgres revierte también el primero.
--
-- La generación de los códigos en sí (alfabeto, formato, unicidad dentro
-- del lote) sigue viviendo en TypeScript (src/lib/codigoInvitacion.ts) —
-- este RPC solo recibe el arreglo ya generado y lo inserta. Si el insert
-- falla por 23505 (un código del lote choca con uno ya existente en la
-- tabla, algo casi imposible con 31^8 combinaciones pero no descartable),
-- el Server Action reintenta generando un lote de códigos nuevo por
-- completo (src/actions/admin/lotesCodigosInvitacion.ts), igual que
-- crearCodigoInvitacion reintenta un código suelto.
--
-- Mismo criterio de exposición que cerrar_suscripcion_caducada_admin (041):
-- SECURITY DEFINER + chequeo explícito de private.es_administrador() adentro,
-- grant a `authenticated` — porque quien llama es la sesión real del
-- administrador (admin.supabase en requireAdmin()), no el service role.
-- ============================================================

create or replace function public.crear_lote_codigos_invitacion(
  p_codigos text[],
  p_duracion_dias int,
  p_fecha_vencimiento timestamptz
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_lote_id uuid;
begin
  if not private.es_administrador() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;

  if p_codigos is null or array_length(p_codigos, 1) is null or array_length(p_codigos, 1) < 1 then
    raise exception 'El lote necesita al menos un código.' using errcode = '22023';
  end if;

  insert into public.lotes_codigos_invitacion (
    cantidad, duracion_dias, fecha_vencimiento, id_admin_creador
  ) values (
    array_length(p_codigos, 1), p_duracion_dias, p_fecha_vencimiento, auth.uid()
  )
  returning id into v_lote_id;

  -- Si cualquier fila choca con un `codigo` ya existente (23505), esta
  -- excepción revierte también el insert de arriba: no queda un lote
  -- huérfano sin códigos.
  insert into public.codigos_invitacion (
    codigo, duracion_dias, id_admin_creador, fecha_vencimiento, limite_usos, activo, id_lote
  )
  select c, p_duracion_dias, auth.uid(), p_fecha_vencimiento, 1, true, v_lote_id
  from unnest(p_codigos) as c;

  return v_lote_id;
end;
$$;

grant execute on function public.crear_lote_codigos_invitacion(text[], int, timestamptz) to authenticated;
