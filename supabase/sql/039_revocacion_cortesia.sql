-- ============================================================
-- Una cortesía revocada deja de dar acceso (f4accesos.md)
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-038.
-- Redefine `private.tiene_acceso_vigente_curso()` (última versión: 038) y
-- la policy `recursos_select_con_acceso` (última versión: 038).
--
-- El problema
-- -----------
-- La migración de Prisma 20260828120000_revocacion_acceso_manual agregó
-- `inscripciones.activo` para que revocar una cortesía (Flujo 11) marque
-- la fila en vez de borrarla (src/actions/admin/usuarios.ts,
-- quitarCortesia). Pero nada en RLS ni en las funciones de acceso miraba
-- esa columna todavía -- sin este cambio, una cortesía "revocada" seguía
-- abriendo el candado: la fila seguía ahí, con tipo_acceso = 'CORTESIA'.
--
-- Misma regla en los tres sitios, otra vez
-- -----------------------------------------
-- Esta es la tercera capa que necesita "and inscripciones.activo = true"
-- junto a las dos de TypeScript (src/lib/curso.ts, src/lib/leccion.ts,
-- src/lib/video/reproduccion.ts, todas ya corregidas en el mismo cambio).
-- ============================================================

create or replace function private.tiene_acceso_vigente_curso(p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    -- Cortesía: acceso incondicional, publicado o no -- pero solo mientras
    -- siga activa. Una revocada no debe volver a abrir el curso.
    exists (
      select 1 from public.inscripciones
      where inscripciones.id_usuario = auth.uid()
        and inscripciones.id_curso = p_id_curso
        and inscripciones.tipo_acceso = 'CORTESIA'
        and inscripciones.activo = true
    )
    or (
      -- Membresía: SOLO por suscripción vigente (ver 038).
      private.suscripcion_da_acceso(auth.uid())
      and (
        coalesce((select cursos.mostrado from public.cursos where cursos.id = p_id_curso), false)
        or private.tiene_progreso_en_curso(p_id_curso)
      )
    );
$$;

grant execute on function private.tiene_acceso_vigente_curso(uuid) to authenticated;

drop policy if exists "recursos_select_con_acceso" on public.recursos_descargables;
create policy "recursos_select_con_acceso" on public.recursos_descargables
  for select using (
    private.es_administrador()
    or exists (
      select 1 from public.lecciones
      join public.modulos on modulos.id = lecciones.id_modulo
      join public.cursos on cursos.id = modulos.id_curso
      where lecciones.id = recursos_descargables.id_leccion
        and (
          exists (
            select 1 from public.inscripciones
            where inscripciones.id_usuario = auth.uid()
              and inscripciones.id_curso = cursos.id
              and inscripciones.tipo_acceso = 'CORTESIA'
              and inscripciones.activo = true
          )
          or private.suscripcion_da_acceso(auth.uid())
        )
    )
  );
