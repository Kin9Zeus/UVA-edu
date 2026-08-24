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
    supabase.from("perfiles").select("id", { count: "exact", head: true }),
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

  const { data: cursos } = await supabase
    .from("cursos")
    .select("id, titulo, mostrado, curso_categorias(categoria:categorias(nombre))")
    .order("creado_en", { ascending: false })
    .limit(20);

  const { data: todasInscripciones } = await supabase.from("inscripciones").select("id_curso");

  const conteoInscritos = new Map<string, number>();
  for (const inscripcion of todasInscripciones ?? []) {
    conteoInscritos.set(inscripcion.id_curso, (conteoInscritos.get(inscripcion.id_curso) ?? 0) + 1);
  }

  const topCursos = (cursos ?? [])
    .map((curso) => ({
      ...curso,
      estudiantes: conteoInscritos.get(curso.id) ?? 0,
    }))
    .sort((a, b) => b.estudiantes - a.estudiantes)
    .slice(0, 5);

  const cursosPopulares: CursoPopular[] = await Promise.all(
    topCursos.map(async (curso) => {
      const { data: progreso } = await supabase
        .from("progreso")
        .select("completado, leccion:lecciones!inner(modulo:modulos!inner(id_curso))")
        .eq("leccion.modulo.id_curso", curso.id);

      const total = progreso?.length ?? 0;
      const completados = progreso?.filter((registro) => registro.completado).length ?? 0;
      const categoriaFila = curso.curso_categorias?.[0]?.categoria;
      const categoria = Array.isArray(categoriaFila) ? categoriaFila[0] : categoriaFila;

      return {
        id: curso.id,
        titulo: curso.titulo,
        categoria: categoria?.nombre ?? "Sin categoría",
        estudiantes: curso.estudiantes,
        porcentajeFinalizacion: total > 0 ? Math.round((completados / total) * 100) : 0,
        mostrado: curso.mostrado,
      };
    }),
  );

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
