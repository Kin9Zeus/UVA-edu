-- ============================================================
-- 111 — Comunidad: campos estructurados de la categoría EMPLEO
-- ============================================================
-- Hasta acá Empleo era texto libre igual que Preguntas/Proyectos. Las 4
-- columnas nuevas (empresa/modalidad/ubicación/enlace, migración de Prisma
-- 20260914000000_comunidad_empleo_campos) solo tienen sentido junto a
-- `categoria = 'EMPLEO'` — este script cierra esa coherencia a nivel de
-- base (CHECK), abre su UPDATE por columna (igual que 083 hizo con
-- contenido/titulo) y extiende el trigger de transiciones (087) con la
-- misma regla que ya aplica ahí: solo el propio autor puede reescribirlas,
-- nunca mientras el post está eliminado.
-- ============================================================

-- Backfill: hay publicaciones de EMPLEO creadas antes de que estas 4
-- columnas existieran (algunas ya `eliminado = true`, otras vivas) — todas
-- nacieron con las 4 en null, así que el CHECK de abajo las rechazaría de
-- entrada. Se rellenan con un placeholder explícito una sola vez; ninguna
-- publicación nueva pasa por acá — crearPostComunidad exige los 3 campos
-- obligatorios desde el composer (src/actions/comunidad/crear.ts).
update public.comunidad_posts
set
  empleo_empresa = coalesce(empleo_empresa, 'Sin especificar (publicación previa a este campo)'),
  empleo_modalidad = coalesce(empleo_modalidad, 'REMOTO'),
  empleo_enlace = coalesce(empleo_enlace, 'https://uva.edu.co/dashboard/comunidad')
where categoria = 'EMPLEO';

-- Todas obligatorias en EMPLEO menos ubicación (no aplica igual a un
-- puesto remoto), y las 4 en null para cualquier otra categoría — mismo
-- idioma que comunidad_reportes_exactamente_uno (090).
do $$
begin
  alter table public.comunidad_posts
    add constraint comunidad_posts_empleo_coherente
    check (
      (categoria = 'EMPLEO' and empleo_empresa is not null and empleo_modalidad is not null and empleo_enlace is not null)
      or (categoria <> 'EMPLEO' and empleo_empresa is null and empleo_modalidad is null and empleo_ubicacion is null and empleo_enlace is null)
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.comunidad_posts
    add constraint comunidad_posts_empleo_modalidad_valida
    check (empleo_modalidad is null or empleo_modalidad in ('PRESENCIAL', 'REMOTO', 'HIBRIDO'));
exception
  when duplicate_object then null;
end;
$$;

-- Capa 1 (privilegio de columna) — statement nuevo, no se toca el GRANT
-- original de 083.
grant update (empleo_empresa, empleo_modalidad, empleo_ubicacion, empleo_enlace)
  on public.comunidad_posts to authenticated;

-- Capa 2 (transición concreta) — misma función de 087, con una rama más:
-- reescribir cualquiera de los 4 campos de Empleo solo lo puede hacer el
-- propio autor, mientras el post no esté eliminado ni se esté eliminando
-- en esta misma transacción. A diferencia de contenido/titulo (que además
-- permiten "vaciar al eliminar"), estos campos no tienen ese caso: al
-- eliminar un post de Empleo quedan intactos (no forman parte del
-- placeholder "[publicación eliminada]"), así que la única transición
-- válida es la del propio autor editando.
create or replace function private.comunidad_posts_transiciones_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fijado is distinct from old.fijado and not private.es_administrador() then
    raise exception 'Fijar o desfijar una publicación requiere un administrador.'
      using errcode = 'check_violation';
  end if;

  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Una publicación eliminada solo puede restaurarla un administrador.'
      using errcode = 'check_violation';
  end if;

  if new.contenido is distinct from old.contenido and new.contenido <> '' then
    if old.eliminado or new.eliminado or (select auth.uid()) <> old.id_usuario then
      raise exception 'El contenido de una publicación solo lo puede reescribir su propio autor, mientras no esté eliminada.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.titulo is distinct from old.titulo and new.titulo <> '' then
    if old.eliminado or new.eliminado or (select auth.uid()) <> old.id_usuario then
      raise exception 'El título de una publicación solo lo puede reescribir su propio autor, mientras no esté eliminada.'
        using errcode = 'check_violation';
    end if;
  end if;

  if (
    new.empleo_empresa is distinct from old.empleo_empresa
    or new.empleo_modalidad is distinct from old.empleo_modalidad
    or new.empleo_ubicacion is distinct from old.empleo_ubicacion
    or new.empleo_enlace is distinct from old.empleo_enlace
  ) and (old.eliminado or new.eliminado or (select auth.uid()) <> old.id_usuario) then
    raise exception 'Los datos de la oferta de empleo solo los puede editar su propio autor, mientras no esté eliminada.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
