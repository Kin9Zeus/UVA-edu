-- ============================================================
-- public.comunidad_tiene_acceso() se evalúa una vez por consulta, no una vez
-- por fila. Parte de AUDIT-2026-09-15.md — P2-10.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-112.
--
-- El problema
-- -----------
-- Mismo defecto que 077 y 105 corrigieron para private.es_administrador(),
-- en la función que ninguno de los dos miró. Toda la RLS de Comunidad (083,
-- 086, 090) la llama desnuda:
--
--   create policy "comunidad_posts_select_con_acceso" ... using (public.comunidad_tiene_acceso());
--
-- La función es STABLE y no recibe ninguna columna, pero Postgres no la
-- promueve a InitPlan por su cuenta: la deja en el Filter y la ejecuta por
-- cada fila. Cada ejecución consulta `perfiles` y, para quien no es admin,
-- `suscripciones` (private.suscripcion_da_acceso).
--
-- Medido al preparar 112, dentro de una transacción revertida con 2.000
-- publicaciones sintéticas: un simple `select count(*) from comunidad_posts`
-- tardó ~600 ms para un estudiante y ~230 ms para un admin, con el plan
-- `Seq Scan ... Filter: comunidad_tiene_acceso()`. Con 20.000 publicaciones,
-- buscar_feed_comunidad superó el statement_timeout. No es un costo de la
-- función nueva: cualquier lectura de Comunidad lo pagaba, el feed anterior
-- incluido.
--
-- El remedio es el de 077/105: envolverla en una subconsulta escalar,
-- `(select public.comunidad_tiene_acceso())`, que Postgres sí evalúa una sola
-- vez como InitPlan. Es equivalente: sin argumentos, el resultado solo
-- depende de auth.uid(), que no cambia dentro de una consulta.
--
-- Qué se reescribe
-- ----------------
-- Las 10 policies que la llaman según `pg_policies` (no según los archivos,
-- que se pisan entre sí) y las 2 vistas de 085 que la usan en el WHERE. Cada
-- policy se reescribe con su expresión ACTUAL del catálogo; el único cambio
-- es la envoltura. `correo_verificado()` y `cuenta_activa()` quedan igual:
-- solo aparecen en WITH CHECK de INSERT, que se evalúa sobre las filas que se
-- insertan (una, en la app), no sobre las que se leen.
--
-- scripts/check-rls-initplan.ts se amplía en el mismo cambio para que esta
-- función no vuelva a quedar desnuda.
-- ============================================================

-- ---------- comunidad_posts ----------
drop policy if exists "comunidad_posts_select_con_acceso" on public.comunidad_posts;
create policy "comunidad_posts_select_con_acceso" on public.comunidad_posts
  for select using ((select public.comunidad_tiene_acceso()));

drop policy if exists "comunidad_posts_insert_propio" on public.comunidad_posts;
create policy "comunidad_posts_insert_propio" on public.comunidad_posts
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (select public.comunidad_tiene_acceso())
    and fijado = false
    and (categoria <> 'ANUNCIOS' or (select private.es_administrador()))
  );

-- ---------- comunidad_respuestas ----------
drop policy if exists "comunidad_respuestas_select_con_acceso" on public.comunidad_respuestas;
create policy "comunidad_respuestas_select_con_acceso" on public.comunidad_respuestas
  for select using ((select public.comunidad_tiene_acceso()));

drop policy if exists "comunidad_respuestas_insert_propio" on public.comunidad_respuestas;
create policy "comunidad_respuestas_insert_propio" on public.comunidad_respuestas
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (select public.comunidad_tiene_acceso())
  );

-- ---------- comunidad_reacciones ----------
drop policy if exists "comunidad_reacciones_select_con_acceso" on public.comunidad_reacciones;
create policy "comunidad_reacciones_select_con_acceso" on public.comunidad_reacciones
  for select using ((select public.comunidad_tiene_acceso()));

drop policy if exists "comunidad_reacciones_insert_propio" on public.comunidad_reacciones;
create policy "comunidad_reacciones_insert_propio" on public.comunidad_reacciones
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (select public.comunidad_tiene_acceso())
  );

-- ---------- comunidad_adjuntos ----------
drop policy if exists "comunidad_adjuntos_select_con_acceso" on public.comunidad_adjuntos;
create policy "comunidad_adjuntos_select_con_acceso" on public.comunidad_adjuntos
  for select using ((select public.comunidad_tiene_acceso()));

drop policy if exists "comunidad_adjuntos_insert_propio" on public.comunidad_adjuntos;
create policy "comunidad_adjuntos_insert_propio" on public.comunidad_adjuntos
  for insert with check (
    (select auth.uid()) = id_usuario
    and (select public.comunidad_tiene_acceso())
    and (
      (id_post is not null and exists (
        select 1 from public.comunidad_posts p
        where p.id = comunidad_adjuntos.id_post and p.id_usuario = (select auth.uid())
      ))
      or
      (id_respuesta is not null and exists (
        select 1 from public.comunidad_respuestas r
        where r.id = comunidad_adjuntos.id_respuesta and r.id_usuario = (select auth.uid())
      ))
    )
  );

-- ---------- comunidad_reportes ----------
drop policy if exists "comunidad_reportes_insert_propio" on public.comunidad_reportes;
create policy "comunidad_reportes_insert_propio" on public.comunidad_reportes
  for insert with check (
    (select auth.uid()) = id_reportante
    and private.correo_verificado()
    and private.cuenta_activa()
    and (select public.comunidad_tiene_acceso())
    and not exists (
      select 1 from public.comunidad_posts p
      where p.id = comunidad_reportes.id_post and p.id_usuario = (select auth.uid())
    )
    and not exists (
      select 1 from public.comunidad_respuestas r
      where r.id = comunidad_reportes.id_respuesta and r.id_usuario = (select auth.uid())
    )
  );

-- ---------- storage.objects (bucket comunidad-adjuntos) ----------
drop policy if exists "comunidad_adjuntos_insert_propio" on storage.objects;
create policy "comunidad_adjuntos_insert_propio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comunidad-adjuntos'
    and (select public.comunidad_tiene_acceso())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------- vistas (085, comunidad_autor_publico redefinida en 091) ----------
-- `create or replace view` con las mismas columnas conserva dueño y GRANTs.
-- buscar_feed_comunidad (112) filtra por nombre del autor contra esta vista.
create or replace view public.comunidad_autor_publico
with (security_barrier = true) as
select distinct p.id, p.nombre, p.foto_url
from public.perfiles p
where (select public.comunidad_tiene_acceso())
  and (
    exists (select 1 from public.comunidad_posts where id_usuario = p.id)
    or exists (select 1 from public.comunidad_respuestas where id_usuario = p.id)
  );

create or replace view public.comunidad_actividad_reciente
with (security_barrier = true) as
select distinct on (c.id_usuario)
  c.id_usuario,
  c.nombre_curso,
  c.fecha_emision
from public.certificados c
where (select public.comunidad_tiene_acceso())
  and (
    exists (select 1 from public.comunidad_posts where id_usuario = c.id_usuario)
    or exists (select 1 from public.comunidad_respuestas where id_usuario = c.id_usuario)
  )
order by c.id_usuario, c.fecha_emision desc;
