import { createClient } from "@/lib/supabase/server";

export type CursoConProgreso = {
  cursoId: string;
  titulo: string;
  categoriaNombre: string;
  leccionesCompletadas: number;
  leccionesTotal: number;
  porcentaje: number;
};

export type ProgresoData = {
  clasesCompletadas: number;
  clasesTotal: number;
  certificados: number;
  cursos: CursoConProgreso[];
};

export async function getProgresoData(usuarioId: string): Promise<ProgresoData> {
  const supabase = await createClient();

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("curso:cursos(id, titulo, categoria:categorias(nombre), modulos(lecciones(id)))")
    .eq("id_usuario", usuarioId);

  const { data: progresoRows } = await supabase
    .from("progreso")
    .select("id_leccion, completado")
    .eq("id_usuario", usuarioId);

  const { count: certificadosCount } = await supabase
    .from("certificados")
    .select("id", { count: "exact", head: true })
    .eq("id_usuario", usuarioId);

  const completadoPorLeccion = new Map<string, boolean>();
  for (const fila of progresoRows ?? []) {
    completadoPorLeccion.set(fila.id_leccion, fila.completado);
  }

  const cursos: CursoConProgreso[] = (inscripciones ?? [])
    .map((fila) => {
      const curso = Array.isArray(fila.curso) ? fila.curso[0] : fila.curso;
      if (!curso) return null;
      const categoria = Array.isArray(curso.categoria) ? curso.categoria[0] : curso.categoria;
      const leccionIds = (curso.modulos ?? []).flatMap((modulo) =>
        (modulo.lecciones ?? []).map((leccion) => leccion.id as string),
      );
      const total = leccionIds.length;
      const completadas = leccionIds.filter((id) => completadoPorLeccion.get(id)).length;

      return {
        cursoId: curso.id as string,
        titulo: curso.titulo as string,
        categoriaNombre: categoria?.nombre ?? "General",
        leccionesCompletadas: completadas,
        leccionesTotal: total,
        porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0,
      };
    })
    .filter((curso): curso is CursoConProgreso => curso !== null);

  const clasesCompletadas = cursos.reduce((total, curso) => total + curso.leccionesCompletadas, 0);
  const clasesTotal = cursos.reduce((total, curso) => total + curso.leccionesTotal, 0);

  return {
    clasesCompletadas,
    clasesTotal,
    certificados: certificadosCount ?? 0,
    cursos,
  };
}
