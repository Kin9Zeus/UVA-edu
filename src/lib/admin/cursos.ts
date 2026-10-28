import { createClient } from "@/lib/supabase/server";
import { getInstructoresDeCursos, type InstructorPublico } from "@/lib/instructores";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { faltasParaPublicar } from "@/lib/admin/publicacion";
import { DIAS_ESTUDIO_CURSOS, DIAS_SIN_AVANZAR } from "@/lib/admin/avance";

export type CursoListado = {
  id: string;
  slug: string;
  titulo: string;
  /** Todas las categorías del curso: `curso_categorias` es muchos-a-muchos. */
  categorias: { id: string; nombre: string }[];
  /** Todos los profesores del curso: la búsqueda del encabezado los encuentra. */
  instructores: InstructorPublico[];
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  mostrado: boolean;
  /** Es el curso que hoy sale en la portada (lib/cursoDestacado.ts). */
  enPortada: boolean;
  modulos: number;
  clases: number;
  sinVideo: number;
  /** Lo que le falta para publicarse; vacío = se puede (lib/admin/publicacion.ts). */
  faltas: { corto: string; motivo: string }[];
  empezaron: number;
  /** Terminaron todas las clases con video. */
  terminaron: number;
  /** Lo empezaron y llevan DIAS_SIN_AVANZAR o más sin tocarlo, sin terminarlo. */
  seQuedaron: number;
};

export type ClaseConAtasco = {
  idLeccion: string;
  leccion: string;
  modulo: string;
  curso: string;
  cursoSlug: string;
  personas: number;
};

export type ResumenCursos = {
  cursos: CursoListado[];
  /** Las clases donde más gente se quedó, de mayor a menor. */
  atascos: ClaseConAtasco[];
  /** Totales sin repetir personas (la fila total de admin_resumen_cursos). */
  personas: number;
  certificados: number;
  seQuedaron: number;
};

const TOPE_ATASCOS = 5;

type FilaResumen = {
  id_curso: string | null;
  empezaron: number;
  terminaron: number;
  se_quedaron: number;
  personas: number;
  certificados: number;
};
type FilaAtasco = {
  id_leccion: string;
  leccion: string;
  modulo: string;
  curso: string;
  curso_slug: string;
  personas: number;
};
type EstadoLeccion = "SUBIENDO" | "PROCESANDO" | "LISTO" | "ERROR";

export async function getCursosListado(): Promise<ResumenCursos> {
  const supabase = await createClient();
  const ahora = Date.now();
  const desde = new Date(ahora - DIAS_ESTUDIO_CURSOS * 86_400_000).toISOString();
  const quieto = new Date(ahora - DIAS_SIN_AVANZAR * 86_400_000).toISOString();

  const [
    { data: cursos, error: errorCursos },
    { data: categoriasDeCursos, error: errorCategorias },
    { data: resumen, error: errorResumen },
    { data: atascos, error: errorAtascos },
  ] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, slug, titulo, nivel, mostrado, destacado, orden_visualizacion, imagen_portada, modulos(lecciones(estado_procesamiento))")
      .order("creado_en", { ascending: false }),
    supabase.from("curso_categorias").select("id_curso, id_categoria, categoria:categorias(nombre)"),
    // Contado en Postgres: antes este archivo traía todas las filas de
    // `progreso` del sitio para contar estudiantes por curso.
    supabase.rpc("admin_resumen_cursos", { p_desde: desde, p_quieto: quieto }),
    supabase.rpc("admin_clases_con_atascos", { p_quieto: quieto, p_limite: TOPE_ATASCOS }),
  ]);
  lanzarSiFalla(errorCursos, "cursos:cursos");
  lanzarSiFalla(errorCategorias, "cursos:curso_categorias");
  lanzarSiFalla(errorResumen, "cursos:admin_resumen_cursos");
  lanzarSiFalla(errorAtascos, "cursos:admin_clases_con_atascos");

  // Se agrupan TODAS las categorías de cada curso, no solo la primera: el
  // filtro por categoría tiene que encontrar un curso también cuando esa
  // categoría es la segunda o la tercera que tiene asignada.
  const categoriasPorCurso = new Map<string, { id: string; nombre: string }[]>();
  for (const fila of categoriasDeCursos ?? []) {
    const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
    const lista = categoriasPorCurso.get(fila.id_curso) ?? [];
    lista.push({ id: fila.id_categoria, nombre: categoria?.nombre ?? "Sin categoría" });
    categoriasPorCurso.set(fila.id_curso, lista);
  }
  for (const lista of categoriasPorCurso.values()) {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  // La vista `curso_instructores_publico` deja pasar los borradores al
  // administrador, así que sirve igual acá que en el catálogo público.
  const instructoresPorCurso = await getInstructoresDeCursos(
    supabase,
    (cursos ?? []).map((curso) => curso.id as string),
  );

  const porCurso = new Map(((resumen ?? []) as FilaResumen[]).map((fila) => [fila.id_curso, fila]));
  const total = porCurso.get(null);

  // El mismo criterio que lib/cursoDestacado.ts: el primero destacado y
  // publicado por orden de visualización. Marcar varios no los muestra todos.
  const enPortada = (cursos ?? [])
    .filter((curso) => curso.destacado && curso.mostrado)
    .sort((a, b) => a.orden_visualizacion - b.orden_visualizacion || String(a.id).localeCompare(String(b.id)))[0]?.id;

  return {
    cursos: (cursos ?? []).map((curso) => {
      const modulos = (curso.modulos ?? []).map((modulo: { lecciones: { estado_procesamiento: EstadoLeccion }[] | null }) => ({
        lecciones: (modulo.lecciones ?? []).map((leccion) => ({ estadoProcesamiento: leccion.estado_procesamiento })),
      }));
      const lecciones = modulos.flatMap((modulo) => modulo.lecciones);
      const suyo = porCurso.get(curso.id);
      return {
        id: curso.id,
        slug: curso.slug,
        titulo: curso.titulo,
        categorias: categoriasPorCurso.get(curso.id) ?? [],
        instructores: instructoresPorCurso.get(curso.id) ?? [],
        nivel: curso.nivel,
        mostrado: curso.mostrado,
        enPortada: curso.id === enPortada,
        modulos: modulos.length,
        clases: lecciones.length,
        sinVideo: lecciones.filter((leccion) => leccion.estadoProcesamiento !== "LISTO").length,
        faltas: faltasParaPublicar({ titulo: curso.titulo, imagenPortada: curso.imagen_portada, modulos }),
        empezaron: Number(suyo?.empezaron ?? 0),
        terminaron: Number(suyo?.terminaron ?? 0),
        seQuedaron: Number(suyo?.se_quedaron ?? 0),
      };
    }),
    atascos: ((atascos ?? []) as FilaAtasco[]).map((fila) => ({
      idLeccion: fila.id_leccion,
      leccion: fila.leccion,
      modulo: fila.modulo,
      curso: fila.curso,
      cursoSlug: fila.curso_slug,
      personas: Number(fila.personas),
    })),
    personas: Number(total?.personas ?? 0),
    certificados: Number(total?.certificados ?? 0),
    seQuedaron: Number(total?.se_quedaron ?? 0),
  };
}

export async function getCategoriasActivas() {
  const supabase = await createClient();
  const { data, error: errorData } = await supabase.from("categorias").select("id, nombre").eq("activo", true).order("nombre");
  lanzarSiFalla(errorData, "cursos:categorias");
  return data ?? [];
}

/**
 * Todas las categorías (activas e inactivas), para el selector del curso al
 * EDITAR uno ya existente.
 *
 * `getCategoriasActivas()` no sirve acá: si el curso ya tenía asignada una
 * categoría que después se desactivó, esa lista no la trae — el selector la
 * mostraba como si el curso no tuviera ninguna categoría ("Sin categoría" en
 * el encabezado de CursoDetalleView) y guardar sin querer se la quitaba. Acá
 * sí se listan las inactivas (SelectorCategorias las marca "(inactiva)"): se
 * pueden ver y desmarcar, pero no hace falta ocultarlas para no ofrecerlas
 * en un curso nuevo — eso ya lo hace getCategoriasActivas() en el formulario
 * de creación.
 */
export async function getCategoriasParaEdicion() {
  const supabase = await createClient();
  const { data, error: errorData } = await supabase.from("categorias").select("id, nombre, activo").order("nombre");
  lanzarSiFalla(errorData, "cursos:categorias");
  return data ?? [];
}

// El selector de instructores del formulario de curso usa
// getPerfilesProfesor() de @/lib/admin/profesores: son cuentas reales con rol
// PROFESOR, no fichas de una tabla de catálogo. `lib/admin/instructores.ts`
// (y con él getInstructoresParaSelector) se eliminó en la migración
// `20260903000000_multi_instructores`.
