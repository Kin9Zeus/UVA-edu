import { cache } from "react";
import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getInstructoresDeCursos, nombresDeInstructores, SIN_INSTRUCTOR } from "@/lib/instructores";
import { esUuid } from "@/lib/slug";
import { logError } from "@/lib/log";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { numeroDePagina, textoDeBusqueda } from "@/lib/parametros-url";
import { REVALIDAR_SEGUNDOS, TAG_CATALOGO, TAG_CATEGORIAS } from "@/lib/cache-catalogo";
import {
  estadoDeCurso,
  porcentajeLecciones,
  porcentajeMostrado,
  type EstadoCursoConExamen,
} from "@/lib/examenes/estadoPorCurso";

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
  /**
   * Suma de la duración de las clases con video LISTO (121), el mismo
   * criterio que la ficha del curso. `null` si la base todavía no trae la
   * columna (un entorno sin el script 121): la tarjeta oculta el dato en vez
   * de mostrar "0 min".
   */
  duracionTotalSegundos: number | null;
  imagenPortada: string;
  /**
   * Avance del estudiante en el curso. Solo lo trae `buscarCatalogoConProgreso()`
   * (catálogo del panel) y solo para los cursos que el estudiante ya empezó;
   * `undefined` = sin empezar, y siempre `undefined` en el catálogo público.
   *
   * `estado` sale de `estadoDeCurso` (la regla de la certificación: si el curso
   * exige examen, aprobarlo basta) y `porcentaje` de `porcentajeMostrado`, el
   * mismo número que muestran "Tu progreso" y el panel de admin.
   */
  progreso?: { estado: EstadoCursoConExamen; porcentaje: number };
};

export { filtroEstadoDeUrl, type FiltroEstado } from "@/lib/filtroEstado";
import { NIVELES, type FiltroEstado, type FiltroNivel } from "@/lib/filtroEstado";

/** `totalCursos`: cursos publicados de la categoría (siempre 1 o más). */
export type CategoriaActiva = { id: string; slug: string; nombre: string; totalCursos: number };

export type CategoriaInfo = { id: string; slug: string; nombre: string; descripcion: string | null };

export type ResultadoCatalogo = {
  cursos: CursoDeCategoria[];
  totalResultados: number;
  pagina: number;
  totalPaginas: number;
  /**
   * La consulta falló y esto es un resultado vacío de emergencia, no el
   * catálogo real. La UI lo usa para decir "no pudimos cargar el catálogo" en
   * vez de "todavía no hay cursos publicados", que era lo que se veía —y se
   * quedaba cacheado 5 minutos— ante cualquier fallo de Supabase
   * (AUDIT-2026-09-22.md, P2-2). Un resultado con `fallo` nunca se cachea:
   * lo arma `catalogoFallido()` FUERA de `unstable_cache`.
   */
  fallo?: true;
};

export const CURSOS_POR_PAGINA = 12;

// Las consultas de este módulo LANZAN ante un error de la base
// (`lanzarSiFalla`, lib/supabase/errores.ts) para que un fallo nunca se
// confunda con "no hay datos" (un catálogo vacío, una categoría que no
// existe).
//
// Dentro de una función cacheada es, además, lo que hace funcionar la caché
// ante un fallo: `unstable_cache` guarda lo que la función DEVUELVE y
// descarta lo que LANZA
// (node_modules/next/dist/server/web/spec-extension/unstable-cache.js: el
// resultado solo se escribe después del `await` de la función). Devolver un
// vacío, como se hacía antes, era pedirle que guardara el vacío.
//
// Además, si lo que falla es la revalidación de una entrada que ya estaba
// vencida, Next sigue sirviendo el último valor bueno en vez del error.

/** Resultado de emergencia para cuando la consulta del catálogo falla. Ver `ResultadoCatalogo.fallo`. */
function catalogoFallido(pagina: number): ResultadoCatalogo {
  return { cursos: [], totalResultados: 0, pagina, totalPaginas: 1, fallo: true };
}

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
 *
 * Ante un fallo devuelve `[]` SIN cachearlo (AUDIT-2026-09-22.md, P2-2): el
 * selector queda vacío mientras dure el fallo, y como el filtro por categoría
 * se resuelve contra esta lista, un `?categoria=` se ignora en ese lapso. Es
 * preferible a mostrar un catálogo vacío.
 */
export async function getCategoriasActivas(): Promise<CategoriaActiva[]> {
  try {
    return await categoriasActivasCacheadas();
  } catch (error) {
    unstable_rethrow(error);
    logError("catalogo:categorias", "no se pudieron cargar las categorías activas", error, { area: "catalogo" });
    return [];
  }
}

const categoriasActivasCacheadas = unstable_cache(
  async (): Promise<CategoriaActiva[]> => {
    const supabase = createPublicClient();
    // Solo las que tienen al menos un curso publicado (`!inner`): ofrecer en
    // el filtro una escuela vacía lleva a un catálogo sin resultados. Mismo
    // criterio que el pie de página y el sitemap.
    const { data, error } = await supabase
      .from("categorias")
      .select("id, slug, nombre, curso_categorias!inner(curso:cursos!inner(id))")
      .eq("activo", true)
      .eq("curso_categorias.curso.mostrado", true)
      .order("nombre");
    lanzarSiFalla(error, "categorias activas");
    // El `!inner` filtrado por `mostrado` deja una fila de curso_categorias
    // por cada curso publicado: su largo es el conteo que muestra la portada.
    return (data ?? []).map(({ id, slug, nombre, curso_categorias }) => ({
      id,
      slug,
      nombre,
      totalCursos: curso_categorias.length,
    }));
  },
  ["categorias-activas"],
  // TAG_CATALOGO también: publicar u ocultar un curso cambia qué escuelas
  // tienen cursos.
  { tags: [TAG_CATEGORIAS, TAG_CATALOGO], revalidate: REVALIDAR_SEGUNDOS },
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
 *
 * `null` significa "no existe o está inactiva" y nada más: las páginas lo
 * convierten en `notFound()`. Un ERROR de la consulta LANZA
 * (AUDIT-2026-09-22.md, P2-3 seguimiento): antes también devolvía `null`, así
 * que durante una caída de Supabase cada categoría respondía 404. Un
 * buscador que rastreara el sitio en ese momento leería "esta página ya no
 * existe" y podría desindexarla; con el error, la página responde con el
 * `error.tsx` (500, "reintenta"), que un rastreador trata como temporal.
 */
export const resolverCategoria = cache(async (identificador: string): Promise<CategoriaInfo | null> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("id, slug, nombre, descripcion")
    .eq(esUuid(identificador) ? "id" : "slug", identificador)
    .eq("activo", true)
    .maybeSingle();
  // `maybeSingle` no marca error cuando no hay fila (eso llega como
  // `data: null`), así que cualquier `error` acá es un fallo real.
  lanzarSiFalla(error, "resolverCategoria");
  return data as CategoriaInfo | null;
});

type OpcionesBuscarCatalogo = {
  query?: string;
  categoriaId?: string;
  pagina?: number;
  /**
   * "Cargar más" del catálogo público: `pagina` dice HASTA qué página se ve,
   * y se traen todos los cursos desde el primero (`?page=3` = los 36
   * primeros). Así la URL reproduce la lista completa al recargar o
   * compartir el enlace. Sin esto, `pagina` es una sola página.
   */
  acumular?: boolean;
  /** Solo estos cursos (filtro por estado, SQL 122). */
  incluir?: string[];
  /** Todos menos estos cursos (filtro por estado, SQL 122). */
  excluir?: string[];
  /** Solo cursos de este nivel. Se resuelve a `incluir`: ver `cursosPorNivelCacheados`. */
  nivel?: FiltroNivel;
};

type ProgresoPorCurso = Map<string, NonNullable<CursoDeCategoria["progreso"]>>;

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
 *
 * LANZA si la consulta falla (AUDIT-2026-09-22.md, P2-2) — ver
 * `lanzarSiFalla`. Quien la llama decide qué mostrar en ese caso.
 */
async function buscarCatalogoConCliente(
  supabase: SupabaseClient,
  opciones: OpcionesBuscarCatalogo,
  /** Avance del estudiante (catálogo del panel); `null` en el público. Puede
   * llegar como promesa para pedirlo en paralelo con la búsqueda. */
  progreso: ProgresoPorCurso | Promise<ProgresoPorCurso> | null,
): Promise<ResultadoCatalogo> {
  // Se normaliza también acá, aunque los llamadores ya lo hacen: es lo que
  // llega a la base, y no debe depender de que cada página se acuerde.
  const pagina = numeroDePagina(opciones.pagina ?? 1);
  const offset = opciones.acumular ? 0 : (pagina - 1) * CURSOS_POR_PAGINA;
  const limite = opciones.acumular ? pagina * CURSOS_POR_PAGINA : CURSOS_POR_PAGINA;

  // El nivel entra como lista de cursos a incluir (cruzada con la del filtro
  // por estado, si la hay): `buscar_catalogo` no tiene parámetro de nivel y
  // así no hace falta tocar la base.
  let incluir = opciones.incluir;
  if (opciones.nivel) {
    const delNivel = new Set((await cursosPorNivelCacheados())[opciones.nivel]);
    incluir = incluir ? incluir.filter((id) => delNivel.has(id)) : [...delNivel];
  }

  const { data, error } = await supabase.rpc("buscar_catalogo", {
    p_query: textoDeBusqueda(opciones.query) ?? null,
    p_categoria_id: opciones.categoriaId || null,
    p_limite: limite,
    p_offset: offset,
    // Solo se mandan cuando hay filtro: así la llamada sigue sirviendo con
    // una base sin el script 122 (los 4 argumentos de siempre).
    ...(incluir ? { p_incluir: incluir } : {}),
    ...(opciones.excluir ? { p_excluir: opciones.excluir } : {}),
  });

  lanzarSiFalla(error, "buscar_catalogo");

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
    /** Ausente si la base no tiene el script 121. */
    duracion_total_segundos?: number | null;
  };

  const filas = (data ?? []) as FilaBusqueda[];
  const totalResultados = filas[0]?.total_resultados ?? 0;

  const progresoPorCurso = progreso ? await progreso : null;

  const cursos: CursoDeCategoria[] = filas.map((fila) => ({
    id: fila.curso_id,
    slug: fila.curso_slug,
    titulo: fila.titulo,
    nivel: fila.nivel,
    instructorNombre: fila.instructor_nombre ?? SIN_INSTRUCTOR,
    categorias: fila.categorias?.length ? fila.categorias : [{ id: "general", nombre: "General" }],
    totalClases: Number(fila.total_clases),
    duracionTotalSegundos: fila.duracion_total_segundos == null ? null : Number(fila.duracion_total_segundos),
    imagenPortada: fila.imagen_portada,
    progreso: progresoPorCurso?.get(fila.curso_id),
  }));

  return {
    cursos,
    totalResultados,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(totalResultados / CURSOS_POR_PAGINA)),
  };
}

/**
 * Catálogo público (`/catalogo`) — cliente sin cookies, sin progreso del
 * estudiante. Lista ACUMULADA ("cargar más"): `pagina` es hasta qué página se
 * ve, ver `OpcionesBuscarCatalogo.acumular`.
 *
 * Qué se cachea y qué no (AUDIT-2026-09-22.md, P2-2 y P2-3)
 * ---------------------------------------------------------
 * - El LISTADO (sin texto de búsqueda, con o sin categoría) sí: es lo que ve
 *   casi toda visita, y es idéntico para cualquiera. Ver
 *   `listadoPublicoCacheado`.
 * - Una BÚSQUEDA con texto no: va directo a la base, como antes de que
 *   existiera la caché. Cachearla daba una entrada nueva en disco por cada
 *   texto distinto —ilimitadas, y generables por cualquiera con un bucle de
 *   `?q=<aleatorio>`— a cambio de acelerar solo la repetición exacta de una
 *   búsqueda, que casi nunca ocurre.
 * - Un FALLO nunca: se registra y se devuelve `catalogoFallido()`, que la
 *   página muestra como "no pudimos cargar el catálogo". Si lo que falla es
 *   la revalidación de un listado ya cacheado, Next sigue sirviendo ese
 *   listado (ver `lanzarSiFalla`).
 */
export async function buscarCatalogoPublico(opciones: OpcionesBuscarCatalogo): Promise<ResultadoCatalogo> {
  const query = textoDeBusqueda(opciones.query);
  const pagina = numeroDePagina(opciones.pagina ?? 1);

  try {
    return query
      ? await buscarCatalogoConCliente(
          createPublicClient(),
          { query, categoriaId: opciones.categoriaId, nivel: opciones.nivel, pagina, acumular: true },
          null,
        )
      : await listadoPublicoCacheado(opciones.categoriaId ?? null, opciones.nivel ?? null, pagina);
  } catch (error) {
    unstable_rethrow(error);
    logError("catalogo:publico", "no se pudo cargar el catálogo público", error, {
      area: "catalogo",
      conBusqueda: Boolean(query),
      pagina,
    });
    return catalogoFallido(pagina);
  }
}

/**
 * La única parte cacheada del catálogo público: el listado sin búsqueda.
 *
 * Recibe argumentos posicionales y YA normalizados a propósito:
 * `unstable_cache` arma la clave con `JSON.stringify(args)`, así que cualquier
 * variación de entrada (`page=1.5`, un `categoriaId` como `undefined` en vez
 * de `null`) sería una entrada distinta para el mismo resultado. Normalizado,
 * el conjunto de claves posibles es finito: (categorías activas + 1) ×
 * 4 niveles (con "todos") × `PAGINA_MAXIMA`. `categoriaId` sale siempre de la
 * base (la lista de categorías activas o `resolverCategoria`), nunca del texto
 * de la URL, y el nivel de `filtroNivelDeUrl`.
 */
const listadoPublicoCacheado = unstable_cache(
  async (categoriaId: string | null, nivel: FiltroNivel | null, pagina: number): Promise<ResultadoCatalogo> =>
    buscarCatalogoConCliente(
      createPublicClient(),
      { categoriaId: categoriaId ?? undefined, nivel: nivel ?? undefined, pagina, acumular: true },
      null,
    ),
  // Clave nueva desde "cargar más": una entrada guardada con la forma
  // anterior (una sola página, sin duración) no debe servirse con esta.
  ["catalogo-publico-acumulado"],
  { tags: [TAG_CATALOGO], revalidate: REVALIDAR_SEGUNDOS },
);

/**
 * Catálogo del dashboard (`/dashboard/catalogo`) — cliente de sesión, con
 * progreso del estudiante. La fuente es `progreso_cursos_estudiante` (033),
 * otorgada nada más a `authenticated`: pedirla desde el cliente público
 * fallaría con un error de permisos, por eso esta rama necesita la sesión.
 *
 * No se cachea (depende de quién mira), pero comparte el manejo de fallos del
 * público: un error de la consulta se muestra como tal, no como "todavía no
 * hay cursos publicados".
 */
export async function buscarCatalogoConProgreso(
  opciones: OpcionesBuscarCatalogo & { estado?: FiltroEstado },
): Promise<ResultadoCatalogo> {
  const pagina = numeroDePagina(opciones.pagina ?? 1);
  // Fuera del try: `createClient()` lee `cookies()`, y lo que eso pueda lanzar
  // es de Next, no un fallo del catálogo.
  const supabase = await createClient();

  try {
    const { estado, ...resto } = opciones;
    // Lista acumulada ("cargar más"), igual que el catálogo público.
    const base = { ...resto, pagina, acumular: true };
    if (!estado) {
      // Sin filtro, el avance se pide en paralelo con la búsqueda.
      return await buscarCatalogoConCliente(supabase, base, getProgresoPorCurso(supabase));
    }
    // Con filtro, el avance decide qué cursos entran: va primero.
    const progreso = await getProgresoPorCurso(supabase);
    return await buscarCatalogoConCliente(supabase, { ...base, ...filtroDeEstado(estado, progreso) }, progreso);
  } catch (error) {
    unstable_rethrow(error);
    logError("catalogo:dashboard", "no se pudo cargar el catálogo del dashboard", error, {
      area: "catalogo",
      conBusqueda: Boolean(textoDeBusqueda(opciones.query)),
      pagina,
      estado: opciones.estado,
    });
    return catalogoFallido(pagina);
  }
}

/**
 * Qué cursos entran en cada filtro de estado, a partir del avance del
 * estudiante. "Sin empezar" = los que no tienen fila en
 * `progreso_cursos_estudiante` (nunca abrió una clase), igual que en "Tu
 * progreso". "Examen pendiente" entra en EN_PROGRESO.
 */
export function filtroDeEstado(
  estado: FiltroEstado,
  progreso: ProgresoPorCurso,
): Pick<OpcionesBuscarCatalogo, "incluir" | "excluir"> {
  const empezados = [...progreso.keys()];
  if (estado === "SIN_EMPEZAR") return { excluir: empezados };
  const completado = (id: string) => progreso.get(id)?.estado === "COMPLETADO";
  return {
    incluir: empezados.filter((id) => (estado === "COMPLETADO" ? completado(id) : !completado(id))),
  };
}

/**
 * `curso_id -> {estado, porcentaje}` de TODOS los cursos que el estudiante
 * empezó (033/078; la vista ya filtra por `auth.uid()`). Son pocos —los que
 * tocó, no el catálogo— y así sirve para dos cosas: las insignias de las
 * tarjetas y el filtro por estado, que necesita saber qué cursos excluir o
 * incluir antes de buscar. Un curso que nunca tocó no tiene fila: queda fuera
 * del mapa y es "sin empezar".
 *
 * La regla la decide `estadoDeCurso` (la misma de getProgresoData() y del
 * panel de admin): si el curso exige examen, aprobarlo basta aunque falten
 * clases (supabase/sql/114). Antes esto se calculaba acá a mano y se había
 * quedado con la regla vieja (100% de clases Y examen aprobado): la tarjeta
 * del catálogo no marcaba "Completado" un curso que en "Mi progreso" sí lo
 * estaba (P2-4, AUDIT-2026-09-22.md).
 */
async function getProgresoPorCurso(supabase: SupabaseClient): Promise<ProgresoPorCurso> {
  const progresoPorCurso: ProgresoPorCurso = new Map();

  const { data, error } = await supabase
    .from("progreso_cursos_estudiante")
    .select("curso_id, lecciones_total, lecciones_completadas, examen_requerido, examen_aprobado");
  // Un mapa vacío por fallo quitaría las insignias de avance y, con un filtro
  // por estado, mostraría cursos que no corresponden.
  lanzarSiFalla(error, "categoria:progreso del estudiante");

  for (const fila of data ?? []) {
    const examen = { requerido: fila.examen_requerido === true, aprobado: fila.examen_aprobado === true };
    const lecciones = porcentajeLecciones(fila.lecciones_completadas as number, fila.lecciones_total as number);
    progresoPorCurso.set(fila.curso_id as string, {
      estado: estadoDeCurso(lecciones, examen),
      porcentaje: porcentajeMostrado(lecciones, examen),
    });
  }
  return progresoPorCurso;
}

/**
 * Ids de los cursos publicados de cada nivel, para el filtro por nivel del
 * catálogo (entra a `buscar_catalogo` como `p_incluir`). Son pocos cursos y
 * la lista es la misma para todos, así que se cachea junto con el catálogo.
 * Lanza si falla: quien filtra muestra el fallo, no una lista equivocada.
 */
const cursosPorNivelCacheados = unstable_cache(
  async (): Promise<Record<FiltroNivel, string[]>> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("cursos").select("id, nivel").eq("mostrado", true);
    lanzarSiFalla(error, "cursos por nivel");
    const porNivel: Record<FiltroNivel, string[]> = { BASICO: [], INTERMEDIO: [], AVANZADO: [] };
    for (const fila of data ?? []) porNivel[fila.nivel as FiltroNivel]?.push(fila.id as string);
    return porNivel;
  },
  ["cursos-por-nivel"],
  { tags: [TAG_CATALOGO], revalidate: REVALIDAR_SEGUNDOS },
);

/**
 * Niveles que tienen al menos un curso publicado: el filtro solo ofrece esos,
 * para que ninguna opción lleve a una lista vacía. Ante un fallo devuelve `[]`
 * (sin cachearlo) y la página oculta el filtro de nivel mientras dure.
 */
export async function getNivelesConCursos(): Promise<FiltroNivel[]> {
  try {
    const porNivel = await cursosPorNivelCacheados();
    return NIVELES.filter((nivel) => porNivel[nivel].length > 0);
  } catch (error) {
    unstable_rethrow(error);
    logError("catalogo:niveles", "no se pudieron cargar los niveles del catálogo", error, { area: "catalogo" });
    return [];
  }
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
 *
 * Ante un fallo devuelve `[]` sin cachearlo (AUDIT-2026-09-22.md, P2-2): el
 * buscador se queda sin sugerencias mientras dure el fallo, pero la búsqueda
 * en sí sigue funcionando.
 */
export async function getCursosParaBuscador(): Promise<CursoOpcionBuscador[]> {
  try {
    return await cursosParaBuscadorCacheados();
  } catch (error) {
    unstable_rethrow(error);
    logError("catalogo:buscador", "no se pudieron cargar los cursos del buscador", error, { area: "catalogo" });
    return [];
  }
}

const cursosParaBuscadorCacheados = unstable_cache(
  async (): Promise<CursoOpcionBuscador[]> => {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("cursos")
      .select("id, titulo")
      .eq("mostrado", true)
      .order("titulo");
    lanzarSiFalla(error, "cursos para el buscador");

    const cursos = data ?? [];
    // Dos consultas fijas, no una por curso: el nombre del profesor vive en
    // `perfiles`, así que se resuelve vía la vista pública en vez de un embed
    // directo de PostgREST hacia `perfiles` (ver lib/instructores.ts).
    // `estricto`: si esa consulta falla, que lance, en vez de cachear 5
    // minutos todos los cursos como "Sin instructor".
    const instructoresPorCurso = await getInstructoresDeCursos(
      supabase,
      cursos.map((curso) => curso.id as string),
      { estricto: true },
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
