-- ============================================================
-- 090 — Comunidad: reportar/denunciar un post o una respuesta
-- ============================================================
-- Hasta ahora la única moderación posible era que un admin navegara el
-- feed y notara algo raro — `comunidad_moderacion` es evidencia de lo que
-- YA se borró, no una cola de lo que falta revisar. Esta tabla es esa cola
-- de entrada: cualquier usuario con acceso a Comunidad puede reportar
-- contenido ajeno, y solo un admin puede leerla (Capítulo 2: pantalla
-- /admin/comunidad).
--
-- Un reporte NO oculta ni afecta el contenido por sí solo — es responsabilidad
-- del admin decidir si elimina (reusa eliminarPostComunidad/
-- eliminarRespuestaComunidad, que ya registran evidencia + motivo + avisan
-- al autor) o descarta el reporte (marca `revisado = true` sin más).

-- Exclusividad post/respuesta, mismo patrón que comunidad_reacciones/
-- comunidad_moderacion (083).
do $$
begin
  alter table public.comunidad_reportes
    add constraint comunidad_reportes_exactamente_uno
    check (num_nonnulls(id_post, id_respuesta) = 1);
exception
  when duplicate_object then null; -- ya existe, script re-corrido sin problema
end;
$$;

-- Un usuario reporta una sola vez el mismo post/respuesta — evita que
-- alguien spamee reportes sobre el mismo contenido para inflar la cola.
create unique index if not exists comunidad_reportes_post_unico_por_reportante
  on public.comunidad_reportes (id_reportante, id_post)
  where id_post is not null;

create unique index if not exists comunidad_reportes_respuesta_unico_por_reportante
  on public.comunidad_reportes (id_reportante, id_respuesta)
  where id_respuesta is not null;

alter table public.comunidad_reportes enable row level security;

-- INSERT: cualquiera con acceso vigente a Comunidad, y nunca sobre el
-- propio contenido — se valida acá vía subconsulta (RLS no puede leer
-- OLD/NEW de otra tabla en un simple `using`, así que se hace explícito).
drop policy if exists "comunidad_reportes_insert_propio" on public.comunidad_reportes;
create policy "comunidad_reportes_insert_propio" on public.comunidad_reportes
  for insert with check (
    (select auth.uid()) = id_reportante
    and private.correo_verificado()
    and private.cuenta_activa()
    and public.comunidad_tiene_acceso()
    and not exists (
      select 1 from public.comunidad_posts p
      where p.id = id_post and p.id_usuario = (select auth.uid())
    )
    and not exists (
      select 1 from public.comunidad_respuestas r
      where r.id = id_respuesta and r.id_usuario = (select auth.uid())
    )
  );

-- SELECT/UPDATE: exclusivo de administradores — es la cola de moderación,
-- ni el reportante ni el autor reportado deben poder verla u ojearla.
drop policy if exists "comunidad_reportes_select_admin" on public.comunidad_reportes;
create policy "comunidad_reportes_select_admin" on public.comunidad_reportes
  for select using (private.es_administrador());

drop policy if exists "comunidad_reportes_update_admin" on public.comunidad_reportes;
create policy "comunidad_reportes_update_admin" on public.comunidad_reportes
  for update using (private.es_administrador()) with check (private.es_administrador());

revoke update on public.comunidad_reportes from anon;
revoke update on public.comunidad_reportes from authenticated;
-- Capa 2 (columna): un admin solo puede marcar `revisado`, nunca reescribir
-- el motivo original ni reasignar a qué post/respuesta apunta el reporte.
grant update (revisado) on public.comunidad_reportes to authenticated;

revoke delete on public.comunidad_reportes from anon;
revoke delete on public.comunidad_reportes from authenticated;
