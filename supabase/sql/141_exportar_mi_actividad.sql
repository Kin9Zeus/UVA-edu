-- ============================================================
-- Exportación de datos personales: la actividad propia que RLS esconde
-- cuando el acceso se venció (P3-8, auditorias/AUDIT-2026-11-23.md;
-- Ley 1581 art. 8, derecho de acceso).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-140.
--
-- `exportarMisDatos` (src/actions/perfil/exportar-datos.ts) lee con la
-- sesión. Comunidad, comentarios y reseñas solo se leen con acceso vigente
-- (comunidad_tiene_acceso, acceso al curso, curso visible): a quien se le
-- venció la suscripción, esas secciones le salían vacías sin error, y
-- comunidad_reportes solo lo lee un administrador.
--
-- No se abren las tablas con una política «propia»: la regla de negocio es
-- que sin suscripción la comunidad no se ve, y una política general dejaría
-- que cualquier pantalla o consulta mostrara lo propio. Esta función es la
-- única salida, devuelve SOLO filas de auth.uid() y nada de otras personas
-- (de lo ajeno, a lo sumo el título de la clase, el curso o la publicación
-- donde la persona escribió). Lo borrado (eliminado = true) no sale, igual
-- que antes en la exportación.
-- ============================================================

create or replace function public.exportar_mi_actividad()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  with yo as (select (select auth.uid()) as id)
  select jsonb_build_object(
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'contenido', c.contenido,
        'creado_en', c.creado_en,
        'leccion', l.titulo
      ) order by c.creado_en)
      from public.comentarios c
      left join public.lecciones l on l.id = c.id_leccion
      where c.id_usuario = (select id from yo) and not c.eliminado
    ), '[]'::jsonb),

    'me_gusta_en_comentarios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'creado_en', cl.creado_en,
        'leccion', l.titulo
      ) order by cl.creado_en)
      from public.comentario_likes cl
      left join public.comentarios c on c.id = cl.id_comentario
      left join public.lecciones l on l.id = c.id_leccion
      where cl.id_usuario = (select id from yo)
    ), '[]'::jsonb),

    'comunidad_posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'titulo', p.titulo,
        'contenido', p.contenido,
        'categoria', p.categoria,
        'creado_en', p.creado_en
      ) order by p.creado_en)
      from public.comunidad_posts p
      where p.id_usuario = (select id from yo) and not p.eliminado
    ), '[]'::jsonb),

    'comunidad_respuestas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'contenido', r.contenido,
        'creado_en', r.creado_en,
        'publicacion', p.titulo
      ) order by r.creado_en)
      from public.comunidad_respuestas r
      left join public.comunidad_posts p on p.id = r.id_post
      where r.id_usuario = (select id from yo) and not r.eliminado
    ), '[]'::jsonb),

    'comunidad_reacciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'a', case when re.id_post is not null then 'publicacion' else 'respuesta' end,
        'creado_en', re.creado_en
      ) order by re.creado_en)
      from public.comunidad_reacciones re
      where re.id_usuario = (select id from yo)
    ), '[]'::jsonb),

    -- Sin ruta_storage: es interna y no es un dato de la persona.
    'comunidad_adjuntos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', a.nombre_original,
        'tipo', a.tipo_archivo,
        'tamano_bytes', a.tamano_bytes,
        'en', case when a.id_post is not null then 'publicacion' else 'respuesta' end,
        'creado_en', a.creado_en
      ) order by a.creado_en)
      from public.comunidad_adjuntos a
      where a.id_usuario = (select id from yo)
    ), '[]'::jsonb),

    'comunidad_reportes_enviados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'motivo', rp.motivo,
        'revisado', rp.revisado,
        'sobre', case when rp.id_post is not null then 'publicacion' else 'respuesta' end,
        'creado_en', rp.creado_en
      ) order by rp.creado_en)
      from public.comunidad_reportes rp
      where rp.id_reportante = (select id from yo)
    ), '[]'::jsonb),

    'calificaciones_de_curso', coalesce((
      select jsonb_agg(jsonb_build_object(
        'puntuacion', cc.puntuacion,
        'comentario', cc.comentario,
        'creado_en', cc.creado_en,
        'curso', cu.titulo
      ) order by cc.creado_en)
      from public.curso_calificaciones cc
      left join public.cursos cu on cu.id = cc.id_curso
      where cc.id_usuario = (select id from yo) and not cc.eliminado
    ), '[]'::jsonb),

    'reacciones_a_calificaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'creado_en', ccr.creado_en,
        'curso', cu.titulo
      ) order by ccr.creado_en)
      from public.curso_calificacion_reacciones ccr
      left join public.curso_calificaciones cc on cc.id = ccr.id_calificacion
      left join public.cursos cu on cu.id = cc.id_curso
      where ccr.id_usuario = (select id from yo)
    ), '[]'::jsonb)
  )
  where (select id from yo) is not null;
$$;

revoke execute on function public.exportar_mi_actividad() from public, anon;
grant execute on function public.exportar_mi_actividad() to authenticated;
