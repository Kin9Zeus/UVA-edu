import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Caché del catálogo (AUDIT-2026-09-22.md, P2-2 y P2-3).
 *
 * `unstable_cache` se reemplaza por un espía que registra, por cada llamada a
 * una función cacheada, si RESOLVIÓ o RECHAZÓ. Es la propiedad que importa:
 * Next solo guarda lo que resuelve (unstable-cache.js escribe el resultado
 * después del `await`), así que "rechazó" es "no quedó en caché". La caché
 * real se comprueba aparte, con `next build` + `next start`.
 */
const cache = vi.hoisted(() => ({
  llamadas: [] as { clave: string; args: unknown[]; resultado: "resolvio" | "rechazo" }[],
}));

vi.mock("next/cache", () => ({
  unstable_cache:
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>, claves: string[]) =>
    async (...args: A): Promise<R> => {
      const clave = claves.join(",");
      try {
        const resultado = await fn(...args);
        cache.llamadas.push({ clave, args, resultado: "resolvio" });
        return resultado;
      } catch (error) {
        cache.llamadas.push({ clave, args, resultado: "rechazo" });
        throw error;
      }
    },
  revalidateTag: vi.fn(),
}));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/supabase/public", () => import("@/test/servidor-falso").then((m) => m.moduloSupabasePublic()));
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const {
  buscarCatalogoPublico,
  buscarCatalogoConProgreso,
  filtroEstadoDeUrl,
  getCategoriasActivas,
  getCursosParaBuscador,
  getNivelesConCursos,
  resolverCategoria,
} = await import("@/lib/categoria");
const { filtrosDeUrl, hrefCatalogo } = await import("@/lib/filtroEstado");
const { logError } = await import("@/lib/log");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

const filaCurso = (id: string, total = 1) => ({
  curso_id: id,
  curso_slug: `curso-${id}`,
  titulo: `Curso ${id}`,
  nivel: "BASICO",
  imagen_portada: "/portada.jpg",
  instructor_nombre: "Ana Ruiz",
  categorias: [{ id: "c1", nombre: "BIM" }],
  total_clases: 4,
  total_resultados: total,
});

const llamadasA = (clave: string) => cache.llamadas.filter((l) => l.clave === clave);

beforeEach(() => {
  servidorFalso.reiniciar();
  cache.llamadas = [];
  vi.mocked(logError).mockClear();
});

describe("buscarCatalogoPublico — qué se cachea", () => {
  it("el listado sin búsqueda pasa por la caché, con argumentos normalizados y posicionales", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [filaCurso("a")], error: null });

    const resultado = await buscarCatalogoPublico({ categoriaId: "cat-1", pagina: 2.7 });

    expect(resultado.cursos).toHaveLength(1);
    expect(resultado.fallo).toBeUndefined();
    // La clave es JSON.stringify(args): `2.7` ya llega como `2`, y la categoría
    // ausente sería `null`, nunca `undefined`.
    expect(llamadasA("catalogo-publico-acumulado")).toEqual([{ clave: "catalogo-publico-acumulado", args: ["cat-1", null, 2], resultado: "resolvio" }]);
  });

  it("sin categoría, la clave lleva `null` explícito (no `undefined`, que JSON.stringify colapsa)", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({});

    expect(llamadasA("catalogo-publico-acumulado")[0].args).toEqual([null, null, 1]);
  });

  it("una búsqueda con texto va directo a la base y NO crea entrada de caché", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [filaCurso("a")], error: null });

    const resultado = await buscarCatalogoPublico({ query: "  revit  ", pagina: 1 });

    expect(resultado.cursos).toHaveLength(1);
    expect(llamadasA("catalogo-publico-acumulado")).toHaveLength(0);
    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_query: "revit" });
  });

  it("solo espacios cuenta como sin búsqueda: usa el listado cacheado", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({ query: "    " });

    expect(llamadasA("catalogo-publico-acumulado")).toHaveLength(1);
    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_query: null });
  });

  it("a la base llegan el texto recortado a 100 caracteres y la página acotada", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({ query: "a".repeat(5000), pagina: 99999 });

    const argumentos = servidorFalso.argumentosDe("rpc:buscar_catalogo") as {
      p_query: string;
      p_offset: number;
      p_limite: number;
    };
    expect(argumentos.p_query).toHaveLength(100);
    // Lista acumulada ("cargar más"): desde el primer curso hasta la página 100.
    expect(argumentos.p_offset).toBe(0);
    expect(argumentos.p_limite).toBe(100 * 12);
  });

  it("cargar más: `pagina` trae todos los cursos hasta esa página, desde el primero", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({ pagina: 3 });

    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_offset: 0, p_limite: 36 });
  });

  it("la duración llega en segundos, y sin la columna queda `null` (no 0)", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", {
      data: [{ ...filaCurso("a"), duracion_total_segundos: 5280 }, filaCurso("b")],
      error: null,
    });

    const { cursos } = await buscarCatalogoPublico({});

    expect(cursos.map((curso) => curso.duracionTotalSegundos)).toEqual([5280, null]);
  });
});

describe("buscarCatalogoPublico — un fallo nunca se cachea", () => {
  it("si la RPC falla, la función cacheada RECHAZA (no queda el vacío guardado) y la página recibe `fallo`", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: null, error: ERROR_PG });

    const resultado = await buscarCatalogoPublico({ pagina: 3 });

    expect(llamadasA("catalogo-publico-acumulado")).toEqual([{ clave: "catalogo-publico-acumulado", args: [null, null, 3], resultado: "rechazo" }]);
    expect(resultado).toEqual({ cursos: [], totalResultados: 0, pagina: 3, totalPaginas: 1, fallo: true });
    expect(logError).toHaveBeenCalledWith(
      "catalogo:publico",
      expect.any(String),
      expect.objectContaining({ message: expect.stringContaining("57014") }),
      expect.objectContaining({ area: "catalogo", conBusqueda: false, pagina: 3 }),
    );
  });

  it("una búsqueda que falla también devuelve `fallo` en vez de lanzar", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: null, error: ERROR_PG });

    const resultado = await buscarCatalogoPublico({ query: "bim" });

    expect(resultado.fallo).toBe(true);
    expect(logError).toHaveBeenCalledWith(
      "catalogo:publico",
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ conBusqueda: true }),
    );
  });

  it("recuperada la base, el siguiente pedido trae el catálogo real (el fallo no quedó guardado)", async () => {
    servidorFalso.responderEnOrden("rpc:buscar_catalogo", [
      { data: null, error: ERROR_PG },
      { data: [filaCurso("a"), filaCurso("b")].map((f) => ({ ...f, total_resultados: 2 })), error: null },
    ]);

    const primero = await buscarCatalogoPublico({});
    const segundo = await buscarCatalogoPublico({});

    expect(primero.fallo).toBe(true);
    expect(segundo.fallo).toBeUndefined();
    expect(segundo.totalResultados).toBe(2);
  });

  it("un catálogo realmente vacío NO es un fallo: se cachea y no se registra error", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    const resultado = await buscarCatalogoPublico({});

    expect(resultado.fallo).toBeUndefined();
    expect(resultado.cursos).toEqual([]);
    expect(llamadasA("catalogo-publico-acumulado")[0].resultado).toBe("resolvio");
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("buscarCatalogoConProgreso (dashboard, sin caché)", () => {
  it("un fallo se muestra como fallo, no como 'todavía no hay cursos'", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: null, error: ERROR_PG });

    const resultado = await buscarCatalogoConProgreso({ pagina: 1 });

    expect(resultado.fallo).toBe(true);
    expect(cache.llamadas).toHaveLength(0);
    expect(logError).toHaveBeenCalledWith("catalogo:dashboard", expect.any(String), expect.anything(), expect.anything());
  });

  it("normaliza igual que el público", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoConProgreso({ query: ` ${"b".repeat(300)} `, pagina: -4 });

    const argumentos = servidorFalso.argumentosDe("rpc:buscar_catalogo") as { p_query: string; p_offset: number };
    expect(argumentos.p_query).toHaveLength(100);
    expect(argumentos.p_offset).toBe(0);
  });
});

describe("getCategoriasActivas", () => {
  it("devuelve las categorías y las cachea", async () => {
    servidorFalso.responder("from:categorias", {
      data: [{ id: "c1", slug: "bim", nombre: "BIM", curso_categorias: [{ curso: { id: "k1" } }] }],
      error: null,
    });

    expect(await getCategoriasActivas()).toEqual([{ id: "c1", slug: "bim", nombre: "BIM", totalCursos: 1 }]);
    expect(llamadasA("categorias-activas")[0].resultado).toBe("resolvio");
  });

  it("solo ofrece escuelas con al menos un curso publicado, sin filtrar el embed hacia la página", async () => {
    servidorFalso.responder("from:categorias", {
      data: [
        { id: "c1", slug: "bim", nombre: "BIM", curso_categorias: [{ curso: { id: "k1" } }, { curso: { id: "k2" } }] },
      ],
      error: null,
    });

    expect(await getCategoriasActivas()).toEqual([{ id: "c1", slug: "bim", nombre: "BIM", totalCursos: 2 }]);
    const filtros = servidorFalso.encadenado("from:categorias", "eq").map((args) => args[0]);
    expect(filtros).toContain("curso_categorias.curso.mostrado");
  });

  it("si la consulta falla: rechaza dentro de la caché y la página recibe [] sin que se guarde", async () => {
    servidorFalso.responder("from:categorias", { data: null, error: ERROR_PG });

    expect(await getCategoriasActivas()).toEqual([]);
    expect(llamadasA("categorias-activas")[0].resultado).toBe("rechazo");
    expect(logError).toHaveBeenCalledWith("catalogo:categorias", expect.any(String), expect.anything(), expect.anything());
  });
});

describe("getCursosParaBuscador", () => {
  it("arma cada curso con sus instructores", async () => {
    servidorFalso.responder("from:cursos", { data: [{ id: "k1", titulo: "Revit" }], error: null });
    servidorFalso.responder("from:curso_instructores_publico", {
      data: [{ id_curso: "k1", id_instructor: "p1", nombre: "Ana Ruiz", especialidad: null, foto_url: null }],
      error: null,
    });

    expect(await getCursosParaBuscador()).toEqual([{ id: "k1", titulo: "Revit", instructorNombre: "Ana Ruiz" }]);
    expect(llamadasA("cursos-para-buscador")[0].resultado).toBe("resolvio");
  });

  it("si fallan los cursos: [] sin cachear", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: ERROR_PG });

    expect(await getCursosParaBuscador()).toEqual([]);
    expect(llamadasA("cursos-para-buscador")[0].resultado).toBe("rechazo");
  });

  it("si fallan los instructores: NO cachea todos los cursos como 'Sin instructor'", async () => {
    servidorFalso.responder("from:cursos", { data: [{ id: "k1", titulo: "Revit" }], error: null });
    servidorFalso.responder("from:curso_instructores_publico", { data: null, error: ERROR_PG });

    expect(await getCursosParaBuscador()).toEqual([]);
    expect(llamadasA("cursos-para-buscador")[0].resultado).toBe("rechazo");
    expect(logError).toHaveBeenCalledWith("catalogo:buscador", expect.any(String), expect.anything(), expect.anything());
  });
});

describe("resolverCategoria — 'no existe' y 'falló' son cosas distintas", () => {
  it("categoría existente: la devuelve", async () => {
    const categoria = { id: "c1", slug: "bim", nombre: "BIM", descripcion: null };
    servidorFalso.responder("from:categorias", { data: categoria, error: null });

    expect(await resolverCategoria("bim")).toEqual(categoria);
  });

  it("no existe o está inactiva: null, y la página hará notFound() (404)", async () => {
    servidorFalso.responder("from:categorias", { data: null, error: null });

    expect(await resolverCategoria("no-existe")).toBeNull();
  });

  it("la consulta falla: LANZA en vez de devolver null (antes era un 404 durante cualquier caída)", async () => {
    servidorFalso.responder("from:categorias", { data: null, error: ERROR_PG });

    await expect(resolverCategoria("bim")).rejects.toThrow(/resolverCategoria falló.*57014/);
  });

  it("un uuid busca por id y un slug por slug (enlaces anteriores al cambio de rutas)", async () => {
    servidorFalso.responder("from:categorias", { data: null, error: null });

    await resolverCategoria("3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f");
    await resolverCategoria("modelado-bim");

    const filtros = servidorFalso.encadenado("from:categorias", "eq").map((args) => args[0]);
    expect(filtros).toEqual(["id", "activo", "slug", "activo"]);
  });
});

/**
 * Marcas "Completado" / "Examen pendiente" de la tarjeta del catálogo del
 * dashboard (P2-4, AUDIT-2026-09-22.md). Antes se calculaban acá con la regla
 * vieja (100% de clases Y examen aprobado) y divergían de "Mi progreso".
 */
describe("buscarCatalogoConProgreso — regla de curso completado (P2-4)", () => {
  function conFilaDeProgreso(fila: {
    lecciones_total: number;
    lecciones_completadas: number;
    examen_requerido: boolean;
    examen_aprobado: boolean;
  }) {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [filaCurso("a")], error: null });
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: [{ curso_id: "a", ...fila }], error: null });
  }

  it("examen aprobado con 5 de 10 clases: la tarjeta sale Completado (el caso visto en producción)", async () => {
    conFilaDeProgreso({ lecciones_total: 10, lecciones_completadas: 5, examen_requerido: true, examen_aprobado: true });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0].progreso).toEqual({ estado: "COMPLETADO", porcentaje: 100 });
  });

  it("todas las clases sin el examen aprobado: Examen pendiente, no Completado", async () => {
    conFilaDeProgreso({ lecciones_total: 10, lecciones_completadas: 10, examen_requerido: true, examen_aprobado: false });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0].progreso).toEqual({ estado: "EXAMEN_PENDIENTE", porcentaje: 100 });
  });

  it("sin examen, 199 de 200 clases no está completado (redondeo hacia abajo)", async () => {
    conFilaDeProgreso({ lecciones_total: 200, lecciones_completadas: 199, examen_requerido: false, examen_aprobado: false });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0].progreso).toEqual({ estado: "EN_PROGRESO", porcentaje: 99 });
  });

  it("un curso que nunca empezó no trae avance (la tarjeta no muestra insignia)", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [filaCurso("a")], error: null });
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: [], error: null });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0].progreso).toBeUndefined();
  });
});

/** Filtro "Sin empezar / En progreso / Completados" del catálogo del panel (SQL 122). */
describe("buscarCatalogoConProgreso — filtro por estado", () => {
  const AVANCE = [
    // a: completado; b: examen pendiente; c: a medias; d nunca se tocó (sin fila).
    { curso_id: "a", lecciones_total: 4, lecciones_completadas: 4, examen_requerido: false, examen_aprobado: false },
    { curso_id: "b", lecciones_total: 4, lecciones_completadas: 4, examen_requerido: true, examen_aprobado: false },
    { curso_id: "c", lecciones_total: 4, lecciones_completadas: 1, examen_requerido: false, examen_aprobado: false },
  ];

  function conAvance() {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: AVANCE, error: null });
  }

  it("sin filtro no manda listas: la llamada sirve igual en una base sin el 122", async () => {
    conAvance();

    await buscarCatalogoConProgreso({});

    const argumentos = servidorFalso.argumentosDe("rpc:buscar_catalogo") as Record<string, unknown>;
    expect(argumentos).not.toHaveProperty("p_incluir");
    expect(argumentos).not.toHaveProperty("p_excluir");
  });

  it("Sin empezar excluye todo lo que el estudiante ya tocó", async () => {
    conAvance();

    await buscarCatalogoConProgreso({ estado: "SIN_EMPEZAR" });

    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_excluir: ["a", "b", "c"] });
  });

  it("En progreso incluye el examen pendiente (todavía no tiene certificado)", async () => {
    conAvance();

    await buscarCatalogoConProgreso({ estado: "EN_PROGRESO" });

    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_incluir: ["b", "c"] });
  });

  it("Completados incluye solo los completados", async () => {
    conAvance();

    await buscarCatalogoConProgreso({ estado: "COMPLETADO" });

    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_incluir: ["a"] });
  });

  it("si el avance no carga, con filtro es un fallo (no una lista equivocada)", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [filaCurso("a")], error: null });
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: null, error: ERROR_PG });

    const resultado = await buscarCatalogoConProgreso({ estado: "COMPLETADO" });

    expect(resultado.fallo).toBe(true);
  });

  it("cargar más también en el panel: lista acumulada desde el primer curso", async () => {
    conAvance();

    await buscarCatalogoConProgreso({ pagina: 2 });

    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_offset: 0, p_limite: 24 });
  });

  it("?estado= de la URL: solo los tres valores conocidos; cualquier otro es Todos", () => {
    expect(filtroEstadoDeUrl("sin-empezar")).toBe("SIN_EMPEZAR");
    expect(filtroEstadoDeUrl("en-progreso")).toBe("EN_PROGRESO");
    expect(filtroEstadoDeUrl("completados")).toBe("COMPLETADO");
    expect(filtroEstadoDeUrl("toString")).toBeUndefined();
    expect(filtroEstadoDeUrl(undefined)).toBeUndefined();
  });
});

/** Filtro por nivel: entra a `buscar_catalogo` como lista de cursos a incluir, sin tocar la base. */
describe("filtro por nivel", () => {
  const CURSOS = [
    { id: "a", nivel: "BASICO" },
    { id: "b", nivel: "BASICO" },
    { id: "c", nivel: "AVANZADO" },
  ];

  it("solo ofrece los niveles que tienen cursos publicados", async () => {
    servidorFalso.responder("from:cursos", { data: CURSOS, error: null });

    expect(await getNivelesConCursos()).toEqual(["BASICO", "AVANZADO"]);
  });

  it("si la consulta falla: sin filtro de nivel (lista vacía), registrado", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: ERROR_PG });

    expect(await getNivelesConCursos()).toEqual([]);
    expect(logError).toHaveBeenCalled();
  });

  it("público: el nivel llega como p_incluir y entra en la clave de la caché", async () => {
    servidorFalso.responder("from:cursos", { data: CURSOS, error: null });
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({ nivel: "BASICO" });

    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_incluir: ["a", "b"] });
    expect(llamadasA("catalogo-publico-acumulado")[0].args).toEqual([null, "BASICO", 1]);
  });

  it("panel: nivel y avance se cruzan (en progreso Y básico)", async () => {
    servidorFalso.responder("from:cursos", { data: CURSOS, error: null });
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });
    servidorFalso.responder("from:progreso_cursos_estudiante", {
      data: [
        { curso_id: "b", lecciones_total: 4, lecciones_completadas: 1, examen_requerido: false, examen_aprobado: false },
        { curso_id: "c", lecciones_total: 4, lecciones_completadas: 1, examen_requerido: false, examen_aprobado: false },
      ],
      error: null,
    });

    await buscarCatalogoConProgreso({ nivel: "BASICO", estado: "EN_PROGRESO" });

    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_incluir: ["b"] });
  });

  it("si no cargan los cursos por nivel, filtrar es un fallo (no una lista equivocada)", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: ERROR_PG });
    servidorFalso.responder("rpc:buscar_catalogo", { data: [filaCurso("a")], error: null });

    expect((await buscarCatalogoPublico({ nivel: "AVANZADO" })).fallo).toBe(true);
  });
});

describe("URL del catálogo", () => {
  it("lee y escribe los mismos filtros (compartir el enlace reproduce la lista)", () => {
    const filtros = filtrosDeUrl({ q: " revit ", categoria: "bim", nivel: "intermedio", estado: "en-progreso", page: "3" });

    expect(filtros).toEqual({ q: "revit", categoria: "bim", nivel: "INTERMEDIO", estado: "EN_PROGRESO", pagina: 3 });
    expect(hrefCatalogo("/catalogo", filtros, { pagina: 3 })).toBe(
      "/catalogo?q=revit&categoria=bim&nivel=intermedio&estado=en-progreso&page=3",
    );
  });

  it("cambiar un filtro vuelve a los primeros cursos y quitarlo lo saca de la URL", () => {
    const filtros = filtrosDeUrl({ categoria: "bim", nivel: "basico", page: "2" });

    expect(hrefCatalogo("/catalogo", filtros, { nivel: undefined })).toBe("/catalogo?categoria=bim");
    expect(hrefCatalogo("/catalogo", filtrosDeUrl({}))).toBe("/catalogo");
  });

  it("un nivel desconocido o repetido en la URL es Todos", () => {
    expect(filtrosDeUrl({ nivel: "toString" }).nivel).toBeUndefined();
    expect(filtrosDeUrl({ nivel: ["basico", "avanzado"] }).nivel).toBe("BASICO");
  });
});
