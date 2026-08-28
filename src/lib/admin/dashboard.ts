import { createClient } from "@/lib/supabase/server";

type ActividadItem = {
  id: string;
  texto: string;
  fecha: string;
  tono: "accent" | "success" | "warning";
};

type CursoPopular = {
  id: string;
  titulo: string;
  categoria: string;
  estudiantes: number;
  porcentajeFinalizacion: number;
  mostrado: boolean;
};

export async function getDashboardData() {
  const supabase = await createClient();

  const [
    { count: usuariosRegistrados },
    { count: cursosPublicados },
    { count: cursosBorrador },
    { count: inscripciones },
  ] = await Promise.all([
    // Solo estudiantes: el panel mide a quienes usan la plataforma, no al
    // equipo de UVA. Antes contaba también a los administradores, así que
    // esta cifra y la de /admin/usuarios no coincidían.
    supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("rol", "ESTUDIANTE"),
    supabase.from("cursos").select("id", { count: "exact", head: true }).eq("mostrado", true),
    supabase.from("cursos").select("id", { count: "exact", head: true }).eq("mostrado", false),
    supabase.from("inscripciones").select("id", { count: "exact", head: true }),
  ]);

  const [{ data: perfilesRecientes }, { data: certificadosRecientes }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, fecha_registro:creado_en")
      .order("creado_en", { ascending: false })
      .limit(4),
    supabase
      .from("certificados")
      .select("id, fecha_emision, usuario:perfiles(nombre), curso:cursos(titulo)")
      .order("fecha_emision", { ascending: false })
      .limit(4),
  ]);

  const actividad: ActividadItem[] = [
    ...(perfilesRecientes ?? []).map((perfil) => ({
      id: `perfil-${perfil.id}`,
      texto: `${perfil.nombre} se registró en la plataforma`,
      fecha: perfil.fecha_registro,
      tono: "accent" as const,
    })),
    ...(certificadosRecientes ?? []).map((cert) => {
      const usuario = Array.isArray(cert.usuario) ? cert.usuario[0] : cert.usuario;
      const curso = Array.isArray(cert.curso) ? cert.curso[0] : cert.curso;
      return {
        id: `cert-${cert.id}`,
        texto: `${usuario?.nombre ?? "Un estudiante"} obtuvo el certificado de ${curso?.titulo ?? "un curso"}`,
        fecha: cert.fecha_emision,
        tono: "success" as const,
      };
    }),
  ]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 6);

  // El avance por curso lo calcula Postgres en la vista `avance_cursos`
  // (supabase/sql/036), no este archivo.
  //
  // Antes se hacía aquí con `completados / total de filas de progreso`, que
  // inflaba la cifra: ignoraba las lecciones que nadie tocó, así que un curso
  // de 20 lecciones donde una persona vio y completó una sola marcaba 100%.
  // Es el mismo bug que ya habían corregido usuarioDetalle.ts y
  // cursoDetalle.ts; este era el último sitio que lo conservaba, y hacía que
  // /admin y /admin/usuarios mostraran números distintos para lo mismo.
  //
  // De paso desaparece el N+1: había una consulta de progreso por cada curso
  // del top, dentro de un Promise.all.
  const [{ data: cursos }, { data: avances }] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, titulo, mostrado, curso_categorias(categoria:categorias(nombre))")
      .order("creado_en", { ascending: false })
      .limit(20),
    supabase
      .from("avance_cursos")
      .select("curso_id, participantes, avance_promedio")
      .order("participantes", { ascending: false })
      .limit(20),
  ]);

  const avancePorCurso = new Map(
    (avances ?? []).map((fila) => [
      fila.curso_id as string,
      {
        estudiantes: Number(fila.participantes),
        porcentaje: Number(fila.avance_promedio),
      },
    ]),
  );

  const cursosPopulares: CursoPopular[] = (cursos ?? [])
    .map((curso) => {
      const avance = avancePorCurso.get(curso.id);
      // Todas las categorías del curso, no solo la primera. Acá se unen en
      // una cadena porque esta tabla del panel es un resumen de una línea
      // por curso; el listado de /admin/cursos sí las pinta como chips.
      const nombresCategorias = (curso.curso_categorias ?? [])
        .map((fila) => {
          const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
          return categoria?.nombre;
        })
        .filter((nombre): nombre is string => !!nombre)
        .sort((a, b) => a.localeCompare(b));

      return {
        id: curso.id,
        titulo: curso.titulo,
        categoria: nombresCategorias.join(", ") || "Sin categoría",
        estudiantes: avance?.estudiantes ?? 0,
        porcentajeFinalizacion: avance?.porcentaje ?? 0,
        mostrado: curso.mostrado,
      };
    })
    .sort((a, b) => b.estudiantes - a.estudiantes)
    .slice(0, 5);

  return {
    metricas: {
      usuariosRegistrados: usuariosRegistrados ?? 0,
      cursosPublicados: cursosPublicados ?? 0,
      cursosBorrador: cursosBorrador ?? 0,
      inscripciones: inscripciones ?? 0,
    },
    actividad,
    cursosPopulares,
  };
}
