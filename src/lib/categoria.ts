import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getInstructoresDeCursos, nombresDeInstructores, SIN_INSTRUCTOR } from "@/lib/instructores";
import { esUuid } from "@/lib/slug";
import { REVALIDAR_SEGUNDOS, TAG_CATALOGO, TAG_CATEGORIAS } from "@/lib/cache-catalogo";
import { estadoDeCurso, porcentajeLecciones } from "@/lib/examenes/estadoPorCurso";

/** Chip de categoría reutilizado por el catálogo y por "Tu progreso" (lib/progreso.ts). */
export type CategoriaChip = { id: string; nombre: string };

export type CursoDeCategoria = {
  id: string;
  slug: string;
  titulo: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  /**
   * Los profesores del curso en una sola línea ("Ana Ruiz, Daniel Castaño").
   * La tarjeta del catálogo tiene una línea truncada para esto, no una ficha
   * por persona, así que se agrega en SQL (`string_agg` dentro de
   * `buscar_catalogo`) y llega ya formateado: una fila por curso, sin una
   * segunda consulta ni un fan-out que rompería la paginación.
   */
  instructorNombre: string;
  /** Todas las categorías del curso — `curso_categorias` es muchos-a-muchos (ver 059). */
  categorias: CategoriaChip[];
  totalClases: number;
  imagenPortada: string;
  /**
   * `true` solo cuando lo trae `buscarCatalogoConProgreso()` (el catálogo
   * del dashboard) y el estudiante ya completó el 100% de las lecciones
   * LISTAS del curso Y, si el curso exige examen final, lo aprobó (Revf5 —
   * mismo criterio que decide la emisión del certificado, ver
   * lib/progreso.ts). En el catálogo público (`buscarCatalogoPublico()`)
   * siempre queda `undefined`.
   */
  completado?: boolean;
  /**
   * `true` cuando terminó el 100% de las clases pero el curso exige examen
   * final y todavía no lo aprobó — el tercer estado de "Tu progreso"
   * (ProgresoContent.tsx). `undefined` en las mismas condiciones que
   * `completado`.
   */
  examenPendiente?: boolean;
};

export type CategoriaActiva = { id: string; slug: string; nombre: string };

export type CategoriaInfo = { id: string; slug: string; nombre: string; descripcion: string | null };

export type ResultadoCatalogo = {
  cursos: CursoDeCategoria[];
  totalResultados: number;
  pagina: number;
  totalPaginas: number;
};

export const CURSOS_POR_PAGINA = 12;

/**
 * Categorías activas para el selector de filtro del catálogo.
 *
 * P2-4 (AUDIT-2026-09-15, Fase 2): cliente público (Anon Key, sin cookies)
 * en vez del cookie-bound. La policy `categorias_select_publico` es
 * `activo = true OR es_administrador()` (077) y acá ya se filtra
 * `.eq("activo", true)` explícito, así que el `OR` del admin solo agrega
 * filas que este `.eq()` descarta de todas formas — el resultado es
 * idéntico para cualquier rol. El selector de edición del panel
 * (`getCategoriasParaEdicion`, src/lib/admin/cursos.ts), que sí necesita
 * ver las inactivas, es una función distinta y no se toca.
 */
export const getCategoriasActivas = unstable_cache(
  async (): Promise<CategoriaActiva[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("categorias").select("id, slug, nombre").eq("activo", true).order("nombre");
    return (data ?? []) as CategoriaActiva[];
  },
  ["categorias-activas"],
  { tags: [TAG_CATEGORIAS], revalidate: REVALIDAR_SEGUNDOS },
);

/**
 * Resuelve una categoría por slug o UUID (los enlaces anteriores al cambio
 * de rutas siguen resolviendo por UUID), sin traer sus cursos — eso lo
 * resuelven buscarCatalogoPublico()/buscarCatalogoConProgreso() por
 * separado, ya paginado y filtrado.
 *
 * P2-4 (Fase 2): mismo cambio de cliente que getCategoriasActivas() — y
 * arriba de eso, envuelta en `cache()` de React porque hoy se llama dos
 * veces por request en `/catalogo/[categoriaSlug]` (generateMetadata + el
 * componente), igual que ya hace getPerfilActual() (lib/perfil.ts).
 */
export const resolverCategoria = cache(async (identificador: string): Promise<CategoriaInfo | null> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, slug, nombre, descripcion")
    .eq(esUuid(identificador) ? "id" : "slug", identificador)
    .eq("activo", true)
    .maybeSingle();
  return data as CategoriaInfo | null;
});

type OpcionesBuscarCatalogo = {
  query?: string;
  categoriaId?: string;
  pagina?: number;
};

/**
 * Revf3 ("Catálogo con búsqueda por palabra clave y filtro por categoría"):
 * la búsqueda, el filtro y la paginación se resuelven en Postgres —
 * `buscar_catalogo` (supabase/sql/034_busqueda_catalogo.sql) usa un índice
 * de trigramas insensible a tildes, no un `.filter()` sobre todo el
 * catálogo traído al cliente.
 *
 * P2-4 (Fase 2): compartida por buscarCatalogoPublico() y
 * buscarCatalogoConProgreso() — antes era una sola función con un flag
 * `incluirProgreso` que decidía el cliente de Supabase por dentro. Se separó
 * en dos exports porque el cliente cookie-bound es *incompatible* con
 * `unstable_cache` (Next.js lo bloquea si detecta `cookies()` dentro), así
 * que la próxima vez que se cachee la rama pública, un flag interno habría
 * sido una trampa fácil de pisar sin darse cuenta. Con dos funciones, usar
 * el cliente equivocado en la rama equivocada falla en el tipo de la firma,
 * no en producción.
 */
async function buscarCatalogoConCliente(
  supabase: SupabaseClient,
  opciones: OpcionesBuscarCatalogo,
  incluirProgreso: boolean,
): Promise<ResultadoCatalogo> {
  const pagina = Math.max(1, Math.floor(opciones.pagina ?? 1) || 1);
  const offset = (pagina - 1) * CURSOS_POR_PAGINA;

  const { data, error } = await supabase.rpc("buscar_catalogo", {
    p_query: opciones.query?.trim() || null,
    p_categoria_id: opciones.categoriaId || null,
    p_limite: CURSOS_POR_PAGINA,
    p_offset: offset,
  });

  if (error || !data) {
    return { cursos: [], totalResultados: 0, pagina, totalPaginas: 1 };
  }

  type FilaBusqueda = {
    curso_id: string;
    curso_slug: string;
    titulo: string;
    nivel: CursoDeCategoria["nivel"];
    imagen_portada: string;
    instructor_nombre: string | null;
    categorias: CategoriaChip[] | null;
    total_clases: number;
    total_resultados: number;
  };

  const filas = data as FilaBusqueda[];
  const totalResultados = filas[0]?.total_resultados ?? 0;

  const progresoPorCurso = incluirProgreso
    ? await getProgresoPorCurso(
        supabase,
        filas.map((fila) => fila.curso_id),
      )
    : null;

  const cursos: CursoDeCategoria[] = filas.map((fila) => ({
    id: fila.curso_id,
    slug: fila.curso_slug,
    titulo: fila.titulo,
    nivel: fila.nivel,
    instructorNombre: fila.instructor_nombre ?? SIN_INSTRUCTOR,
    categorias: fila.categorias?.length ? fila.categorias : [{ id: "general", nombre: "General" }],
    totalClases: Number(fila.total_clases),
    imagenPortada: fila.imagen_portada,
    completado: progresoPorCurso?.get(fila.curso_id)?.completado,
    examenPendiente: progresoPorCurso?.get(fila.curso_id)?.examenPendiente,
  }));

  return {
    cursos,
    totalResultados,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(totalResultados / CURSOS_POR_PAGINA)),
  };
}

/** Catálogo público (`/catalogo`) — cliente sin cookies, sin progreso del estudiante. */
export const buscarCatalogoPublico = unstable_cache(
  async (opciones: OpcionesBuscarCatalogo): Promise<ResultadoCatalogo> => {
    return buscarCatalogoConCliente(createPublicClient(), opciones, false);
  },
  ["catalogo-publico"],
  { tags: [TAG_CATALOGO], revalidate: REVALIDAR_SEGUNDOS },
);

/**
 * Catálogo del dashboard (`/dashboard/catalogo`) — cliente de sesión, con
 * progreso del estudiante. La fuente es `progreso_cursos_estudiante` (033),
 * otorgada nada más a `authenticated`: pedirla desde el cliente público
 * fallaría con un error de permisos, por eso esta rama necesita la sesión.
 */
export async function buscarCatalogoConProgreso(opciones: OpcionesBuscarCatalogo): Promise<ResultadoCatalogo> {
  const supabase = await createClient();
  return buscarCatalogoConCliente(supabase, opciones, true);
}

/**
 * `curso_id -> {completado, examenPendiente}` para el catálogo del
 * dashboard (033/078). Solo trae las filas de los cursos de esta página, no
 * todo el progreso del estudiante. Un curso que el estudiante nunca tocó no
 * tiene fila en la vista — el `Map` simplemente no lo incluye, y `.get()`
 * devuelve `undefined`, que en CursoCard se trata igual que `false`.
 *
 * La regla la decide `estadoDeCurso` (la misma de getProgresoData() y del
 * panel de admin): si el curso exige examen, aprobarlo basta aunque falten
 * clases (supabase/sql/114). Antes esto se calculaba acá a mano y se había
 * quedado con la regla vieja (100% de clases Y examen aprobado): la tarjeta
 * del catálogo no marcaba "Completado" un curso que en "Mi progreso" sí lo
 * estaba (P2-4, AUDIT-2026-09-22.md).
 */
async function getProgresoPorCurso(
  supabase: SupabaseClient,
  cursoIds: string[],
): Promise<Map<string, { completado: boolean; examenPendiente: boolean }>> {
  const progresoPorCurso = new Map<string, { completado: boolean; examenPendiente: boolean }>();
  if (cursoIds.length === 0) return progresoPorCurso;

  const { data } = await supabase
    .from("progreso_cursos_estudiante")
    .select("curso_id, lecciones_total, lecciones_completadas, examen_requerido, examen_aprobado")
    .in("curso_id", cursoIds);

  for (const fila of data ?? []) {
    const estado = estadoDeCurso(
      porcentajeLecciones(fila.lecciones_completadas as number, fila.lecciones_total as number),
      { requerido: fila.examen_requerido === true, aprobado: fila.examen_aprobado === true },
    );

    progresoPorCurso.set(fila.curso_id as string, {
      completado: estado === "COMPLETADO",
      examenPendiente: estado === "EXAMEN_PENDIENTE",
    });
  }
  return progresoPorCurso;
}

export type CursoOpcionBuscador = {
  id: string;
  titulo: string;
  instructorNombre: string;
};

/**
 * Listado liviano (sin imagen ni temario) de todos los cursos publicados,
 * para alimentar el dropdown de sugerencias del buscador (que resalta
 * coincidencias mientras se escribe, sin disparar una consulta al
 * servidor por tecla — ver BuscadorInput.tsx). Se pide una sola vez y se
 * cachea en el cliente — ver src/actions/cursos/buscador.ts.
 *
 * P2-4 (Fase 2): cliente público — `.eq("mostrado", true)` explícito ya
 * filtra igual que la rama pública de `cursos_select_publicos` (077), y
 * `curso_instructores_publico` (ver lib/instructores.ts) es una vista
 * SECURITY DEFINER pensada justo para servir esto sin sesión: es "la única
 * puerta pública a los datos de un profesor", no algo que RLS le niegue a
 * un visitante anónimo.
 */
export const getCursosParaBuscador = unstable_cache(
  async (): Promise<CursoOpcionBuscador[]> => {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("cursos")
    .select("id, titulo")
    .eq("mostrado", true)
    .order("titulo");

  const cursos = data ?? [];
  // Dos consultas fijas, no una por curso: el nombre del profesor vive en
  // `perfiles`, así que se resuelve vía la vista pública en vez de un embed
  // directo de PostgREST hacia `perfiles` (ver lib/instructores.ts).
  const instructoresPorCurso = await getInstructoresDeCursos(
    supabase,
    cursos.map((curso) => curso.id as string),
  );

  return cursos.map((curso) => ({
    id: curso.id,
    titulo: curso.titulo,
    instructorNombre: nombresDeInstructores(instructoresPorCurso.get(curso.id) ?? []),
  }));
  },
  ["cursos-para-buscador"],
  { tags: [TAG_CATALOGO], revalidate: REVALIDAR_SEGUNDOS },
);
