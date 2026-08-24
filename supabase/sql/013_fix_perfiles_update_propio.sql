-- ============================================================
-- FIX DE SEGURIDAD: escalada de privilegios vía UPDATE directo a perfiles
-- Ver docs/technical-spec.md §5 y 001_rls_policies.sql / 005_rls_categorias_y_perfiles_admin.sql.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-012.
--
-- Hallazgo: "perfiles_update_propio" (001_rls_policies.sql:72-73) solo
-- valida en el `using` que el usuario sea dueño de la fila
-- (auth.uid() = id) — no tiene `with check`, así que no restringe QUÉ
-- columnas puede cambiar. Cualquier estudiante autenticado puede correr
-- desde el cliente:
--
--   supabase.from('perfiles').update({ rol: 'ADMINISTRADOR' }).eq('id', miPropioId)
--
-- y la policy lo deja pasar: el usuario se auto-promueve a administrador.
-- Mismo problema con `estado` (un usuario suspendido podría
-- reactivarse a sí mismo).
--
-- 005_rls_categorias_y_perfiles_admin.sql agregó "perfiles_admin_escritura"
-- para que un admin edite el perfil de OTRO usuario, pero documentó
-- explícitamente que no tocaba "perfiles_update_propio" — esa policy
-- seguía activa y vulnerable.
--
-- Este script recrea "perfiles_update_propio" agregando un `with check`
-- que exige que `rol` y `estado` queden exactamente iguales a como
-- estaban antes del UPDATE cuando el usuario edita su propia fila. El
-- resto de columnas (nombre, correo, celular, país, etc. — ver
-- src/actions/perfil/actualizar.ts) sigue sin restricción.
--
-- No afecta a "perfiles_admin_escritura" (005): las políticas de una misma
-- acción se combinan con OR, así que un administrador editando la fila de
-- otro usuario para cambiar su rol/estado sigue pasando por esa policy,
-- no por esta.
-- ============================================================

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and rol = (select rol from public.perfiles where id = auth.uid())
    and estado = (select estado from public.perfiles where id = auth.uid())
  );
