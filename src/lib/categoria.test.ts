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

const { buscarCatalogoPublico, buscarCatalogoConProgreso, getCategoriasActivas, getCursosParaBuscador, resolverCategoria } =
  await import("@/lib/categoria");
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
    expect(llamadasA("catalogo-publico")).toEqual([{ clave: "catalogo-publico", args: ["cat-1", 2], resultado: "resolvio" }]);
  });

  it("sin categoría, la clave lleva `null` explícito (no `undefined`, que JSON.stringify colapsa)", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({});

    expect(llamadasA("catalogo-publico")[0].args).toEqual([null, 1]);
  });

  it("una búsqueda con texto va directo a la base y NO crea entrada de caché", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [filaCurso("a")], error: null });

    const resultado = await buscarCatalogoPublico({ query: "  revit  ", pagina: 1 });

    expect(resultado.cursos).toHaveLength(1);
    expect(llamadasA("catalogo-publico")).toHaveLength(0);
    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_query: "revit" });
  });

  it("solo espacios cuenta como sin búsqueda: usa el listado cacheado", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({ query: "    " });

    expect(llamadasA("catalogo-publico")).toHaveLength(1);
    expect(servidorFalso.argumentosDe("rpc:buscar_catalogo")).toMatchObject({ p_query: null });
  });

  it("a la base llegan el texto recortado a 100 caracteres y la página acotada", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: [], error: null });

    await buscarCatalogoPublico({ query: "a".repeat(5000), pagina: 99999 });

    const argumentos = servidorFalso.argumentosDe("rpc:buscar_catalogo") as { p_query: string; p_offset: number };
    expect(argumentos.p_query).toHaveLength(100);
    expect(argumentos.p_offset).toBe((100 - 1) * 12);
  });
});

describe("buscarCatalogoPublico — un fallo nunca se cachea", () => {
  it("si la RPC falla, la función cacheada RECHAZA (no queda el vacío guardado) y la página recibe `fallo`", async () => {
    servidorFalso.responder("rpc:buscar_catalogo", { data: null, error: ERROR_PG });

    const resultado = await buscarCatalogoPublico({ pagina: 3 });

    expect(llamadasA("catalogo-publico")).toEqual([{ clave: "catalogo-publico", args: [null, 3], resultado: "rechazo" }]);
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
    expect(llamadasA("catalogo-publico")[0].resultado).toBe("resolvio");
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
    const categorias = [{ id: "c1", slug: "bim", nombre: "BIM" }];
    servidorFalso.responder("from:categorias", { data: categorias, error: null });

    expect(await getCategoriasActivas()).toEqual(categorias);
    expect(llamadasA("categorias-activas")[0].resultado).toBe("resolvio");
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

    expect(cursos[0]).toMatchObject({ completado: true, examenPendiente: false });
  });

  it("todas las clases sin el examen aprobado: Examen pendiente, no Completado", async () => {
    conFilaDeProgreso({ lecciones_total: 10, lecciones_completadas: 10, examen_requerido: true, examen_aprobado: false });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0]).toMatchObject({ completado: false, examenPendiente: true });
  });

  it("sin examen, 199 de 200 clases no está completado (redondeo hacia abajo)", async () => {
    conFilaDeProgreso({ lecciones_total: 200, lecciones_completadas: 199, examen_requerido: false, examen_aprobado: false });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0]).toMatchObject({ completado: false, examenPendiente: false });
  });
});
