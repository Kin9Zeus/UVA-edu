-- ============================================================
-- Autoservicio de supresión de datos personales (Ley 1581 / GDPR).
-- Cierra AUDIT-2026-09-15.md — P2-11.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-108.
--
-- El problema
-- -----------
-- La capacidad de anonimizar existe desde 075 (extendida en 104 y 108),
-- pero solo la dispara un administrador (public.anonimizar_usuario, que
-- además bloquea explícitamente p_id_usuario = auth.uid() — a propósito,
-- para que un admin no se autoelimine). No hay ninguna vía para que el
-- propio titular la pida sin pasar por soporte.
--
-- Por qué es una función NUEVA y no relajar la que ya existe
-- ------------------------------------------------------------
-- public.anonimizar_usuario(uuid) recibe el id como parámetro — correcto
-- para un admin actuando sobre otra cuenta, pero equivocado para
-- autoservicio: si aceptara "el propio id" como caso válido, cualquier
-- cliente con una sesión robada de OTRO usuario podría anonimizarlo con
-- solo conocer su uuid, que no es secreto (aparece en URLs, en el DOM).
-- Por eso esta función NO toma ningún parámetro: opera siempre y
-- exclusivamente sobre auth.uid(), la identidad que certifica el JWT, nunca
-- sobre un valor que mande el cliente.
--
-- Por qué un ADMINISTRADOR no puede usarla
-- -------------------------------------------
-- Mismo motivo que ya protege al flujo de admin-sobre-otro: perdería el
-- acceso con el que administra la plataforma, y si es el único
-- administrador, la dejaría sin ninguno — un estado sin vuelta atrás desde
-- la interfaz. Un admin que quiera darse de baja debe hacerlo desde otra
-- cuenta administradora, o cediendo el rol primero.
-- ============================================================

create or replace function public.solicitar_supresion_propia()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_rol "RolPerfil";
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  select rol into v_rol from public.perfiles where id = auth.uid();

  if v_rol is null then
    raise exception 'No existe el perfil de la sesión actual.' using errcode = '02000';
  end if;

  if v_rol = 'ADMINISTRADOR' then
    raise exception 'Una cuenta de administrador no puede autoeliminarse. Pide a otro administrador que la suprima, o cede el rol primero.'
      using errcode = '42501';
  end if;

  perform private.anonimizar_usuario(auth.uid());
end;
$$;

-- Cualquier sesión autenticada puede invocarla sobre SÍ MISMA (la guardia de
-- rol vive adentro); `anon` no, porque exige auth.uid().
revoke execute on function public.solicitar_supresion_propia() from public, anon;
grant execute on function public.solicitar_supresion_propia() to authenticated;
