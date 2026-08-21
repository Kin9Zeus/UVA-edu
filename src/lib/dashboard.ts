import { createClient } from "@/lib/supabase/server";

export type ClaseEnProgreso = {
  leccionId: string;
  cursoId: string;
  cursoTitulo: string;
  moduloTitulo: string;
  categoriaNombre: string;
  segundoActual: number;
  duracion: number | null;
  progreso: number;
};

export type CategoriaConConteo = {
  id: string;
  nombre: string;
  cursos: number;
};

/**
 * Datos reales para el Dashboard/Inicio del estudiante: clases con progreso
 * sin terminar (para "Sigue aprendiendo") y categorías activas con su
 * conteo de cursos publicados (para "Explora por categoría").
 */
export async function getInicioData(usuarioId: string) {
  const supabase = await createClient();

  const { data: progresoRows } = await supabase
    .from("progreso")
    .select(
      "id_leccion, segundo_actual, fecha_actualizacion, leccion:lecciones(id, duracion, modulo:modulos(titulo, curso:cursos(id, titulo, categoria:categorias(nombre))))",
    )
    .eq("id_usuario", usuarioId)
    .eq("completado", false)
    .order("fecha_actualizacion", { ascending: false })
    .limit(4);

  const sigueAprendiendo: ClaseEnProgreso[] = (progresoRows ?? [])
    .map((fila) => {
      const leccion = Array.isArray(fila.leccion) ? fila.leccion[0] : fila.leccion;
      const modulo = leccion ? (Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo) : null;
      const curso = modulo ? (Array.isArray(modulo.curso) ? modulo.curso[0] : modulo.curso) : null;
      const categoria = curso ? (Array.isArray(curso.categoria) ? curso.categoria[0] : curso.categoria) : null;

      if (!leccion || !modulo || !curso) return null;

      const duracion = leccion.duracion;
      const progreso = duracion && duracion > 0
        ? Math.min(100, Math.round((fila.segundo_actual / duracion) * 100))
        : 0;

      return {
        leccionId: fila.id_leccion as string,
        cursoId: curso.id as string,
        cursoTitulo: curso.titulo as string,
        moduloTitulo: modulo.titulo as string,
        categoriaNombre: categoria?.nombre ?? "General",
        segundoActual: fila.segundo_actual as number,
        duracion,
        progreso,
      };
    })
    .filter((fila): fila is ClaseEnProgreso => fila !== null);

  const { data: categoriasRows } = await supabase
    .from("categorias")
    .select("id, nombre")
    .eq("activo", true);

  const { data: cursosRows } = await supabase
    .from("cursos")
    .select("id_categoria")
    .eq("mostrado", true);

  const conteoPorCategoria = new Map<string, number>();
  for (const curso of cursosRows ?? []) {
    conteoPorCategoria.set(curso.id_categoria, (conteoPorCategoria.get(curso.id_categoria) ?? 0) + 1);
  }

  // Se listan todas las categorías activas, tengan o no cursos publicados
  // todavía: es la vitrina del catálogo completo, no solo de lo que ya tiene
  // contenido.
  const categorias: CategoriaConConteo[] = (categoriasRows ?? []).map((categoria) => ({
    id: categoria.id as string,
    nombre: categoria.nombre as string,
    cursos: conteoPorCategoria.get(categoria.id) ?? 0,
  }));

  return { sigueAprendiendo, categorias };
}
