import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { getComunidadDestacados, getComunidadFeed } from "@/lib/comunidad";
import { logError } from "@/lib/log";

/**
 * Feed de Comunidad — AUDIT-2026-09-15.md, P2-10.
 *
 * Qué filtra, busca, ordena y pagina lo decide `buscar_feed_comunidad`
 * (112_feed_comunidad_paginado.sql), y eso se verificó contra la base con el
 * algoritmo anterior como referencia. Aquí se prueba el lado TypeScript,
 * que es donde estaba el problema: que ya no lea el feed entero, que
 * enriquezca SOLO la página y que traduzca bien lo que devuelve la función.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };

/** Una fila como la devuelve PostgREST: los `bigint` llegan como string. */
function fila(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: `post-${id}`,
    id_usuario: "autora-1",
    categoria: "PREGUNTAS",
    titulo: `Título ${id}`,
    contenido: "Texto",
    fijado: false,
    creado_en: "2026-09-10T12:00:00Z",
    empleo_empresa: null,
    empleo_modalidad: null,
    empleo_ubicacion: null,
    empleo_enlace: null,
    total_respuestas: "3",
    total_reacciones: "5",
    me_reaccione: true,
    total_resultados: "41",
    pagina: 2,
    ...extra,
  };
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  vi.mocked(logError).mockClear();
});

describe("getComunidadFeed — qué le pide a la base", () => {
  it("sin opciones: todo el feed, reciente, página 1, 20 por página", async () => {
    await getComunidadFeed();

    expect(servidorFalso.argumentosDe("rpc:buscar_feed_comunidad")).toEqual({
      p_categoria: null,
      p_solo_propios: false,
      p_busqueda: null,
      p_orden: "reciente",
      p_pagina: 1,
      p_por_pagina: 20,
    });
  });

  it("pasa categoría, búsqueda recortada, orden y página", async () => {
    await getComunidadFeed({ categoria: "EMPLEO", busqueda: "  Ana Ruiz  ", orden: "relevancia", pagina: 3 });

    expect(servidorFalso.argumentosDe("rpc:buscar_feed_comunidad")).toMatchObject({
      p_categoria: "EMPLEO",
      p_busqueda: "Ana Ruiz",
      p_orden: "relevancia",
      p_pagina: 3,
    });
  });

  it("'Mis publicaciones' ignora la categoría y no manda ningún id: lo pone la base con auth.uid()", async () => {
    await getComunidadFeed({ soloPropios: true, categoria: "ANUNCIOS" });

    const argumentos = servidorFalso.argumentosDe("rpc:buscar_feed_comunidad") as Record<string, unknown>;
    expect(argumentos).toMatchObject({ p_solo_propios: true, p_categoria: null });
    expect(Object.values(argumentos)).not.toContain(ESTUDIANTE.id);
  });

  it.each([
    ["vacía", "   ", null],
    ["ausente", undefined, null],
  ])("búsqueda %s viaja como null", async (_caso, busqueda, esperado) => {
    await getComunidadFeed({ busqueda });

    expect(servidorFalso.argumentosDe("rpc:buscar_feed_comunidad")).toMatchObject({ p_busqueda: esperado });
  });

  it.each([
    [0, 1],
    [-4, 1],
    [2.7, 2],
    [Number.NaN, 1],
  ])("página %s se manda como %s", async (pagina, esperada) => {
    await getComunidadFeed({ pagina });

    expect(servidorFalso.argumentosDe("rpc:buscar_feed_comunidad")).toMatchObject({ p_pagina: esperada });
  });

  it("ya no lee las tablas del feed completo: publicaciones, respuestas ni reacciones", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", { data: [fila("p1"), fila("p2")] });

    await getComunidadFeed();

    expect(servidorFalso.llamadasA("from:comunidad_posts")).toHaveLength(0);
    expect(servidorFalso.llamadasA("from:comunidad_respuestas")).toHaveLength(0);
    // Las reacciones llegan contadas desde SQL: consultarlas otra vez sería
    // una segunda fuente para el mismo número.
    expect(servidorFalso.llamadasA("from:comunidad_reacciones")).toHaveLength(0);
  });
});

describe("getComunidadFeed — enriquece solo la página", () => {
  it("autores y adjuntos se piden únicamente para las filas devueltas", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", {
      data: [fila("p1"), fila("p2", { id_usuario: "autor-2" })],
    });

    await getComunidadFeed();

    expect(servidorFalso.encadenado("from:comunidad_autor_publico", "in")).toEqual([["id", ["autora-1", "autor-2"]]]);
    expect(servidorFalso.encadenado("from:comunidad_adjuntos", "in")).toEqual([
      ["id_post", ["p1", "p2"]],
      ["id_respuesta", ["p1", "p2"]],
    ]);
  });

  it("firma en Storage solo las imágenes de la página, en un solo lote", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", { data: [fila("p1")] });
    servidorFalso.responderEnOrden("from:comunidad_adjuntos", [
      {
        data: [
          { id: "img", id_post: "p1", id_respuesta: null, ruta_storage: "a/p1/img.webp", nombre_original: "f.webp", es_imagen: true, ancho: 10, alto: 10, tamano_bytes: 1 },
          { id: "doc", id_post: "p1", id_respuesta: null, ruta_storage: "a/p1/doc.pdf", nombre_original: "f.pdf", es_imagen: false, ancho: null, alto: null, tamano_bytes: 1 },
        ],
      },
      { data: [] },
    ]);

    await getComunidadFeed();

    expect(servidorFalso.encadenado("storage:comunidad-adjuntos", "createSignedUrls")).toEqual([[["a/p1/img.webp"], 3600]]);
  });

  it("sin resultados no enriquece nada", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", { data: [] });

    expect(await getComunidadFeed({ pagina: 4 })).toEqual({ posts: [], pagina: 1, totalPaginas: 1 });
    expect(servidorFalso.operaciones()).toEqual(["auth:getClaims", "rpc:buscar_feed_comunidad"]);
  });
});

describe("getComunidadFeed — lo que devuelve", () => {
  it("página y total de páginas salen de la función, no de cuántas filas llegaron", async () => {
    // 41 resultados a 20 por página = 3 páginas, aunque aquí lleguen 2 filas.
    servidorFalso.responder("rpc:buscar_feed_comunidad", { data: [fila("p1"), fila("p2")] });

    const resultado = await getComunidadFeed({ pagina: 2 });

    expect(resultado.pagina).toBe(2);
    expect(resultado.totalPaginas).toBe(3);
  });

  it("respeta la página que la base dice haber devuelto (la acota si se pidió de más)", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", { data: [fila("p1", { pagina: 3 })] });

    expect((await getComunidadFeed({ pagina: 99 })).pagina).toBe(3);
  });

  it("conteos como número, reacción propia y orden tal cual llegó", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", {
      data: [fila("fijada", { fijado: true, me_reaccione: false, total_reacciones: "0" }), fila("p2")],
    });
    servidorFalso.responder("from:comunidad_autor_publico", {
      data: [{ id: "autora-1", nombre: "Ana Ruiz", foto_url: null }],
    });

    const { posts } = await getComunidadFeed();

    expect(posts.map((p) => p.id)).toEqual(["fijada", "p2"]);
    expect(posts[0]).toMatchObject({ fijado: true, totalReacciones: 0, meReaccione: false, totalRespuestas: 3 });
    expect(posts[1]).toMatchObject({
      slug: "post-p2",
      autorNombre: "Ana Ruiz",
      totalRespuestas: 3,
      totalReacciones: 5,
      meReaccione: true,
      eliminado: false,
      datosEmpleo: null,
    });
    expect(typeof posts[1].totalRespuestas).toBe("number");
  });

  it("una publicación de Empleo trae sus datos estructurados", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", {
      data: [
        fila("e1", {
          categoria: "EMPLEO",
          empleo_empresa: "Constructora Andes",
          empleo_modalidad: "REMOTO",
          empleo_ubicacion: null,
          empleo_enlace: "https://andes.example",
        }),
      ],
    });

    const { posts } = await getComunidadFeed();

    expect(posts[0].datosEmpleo).toEqual({
      empresa: "Constructora Andes",
      modalidad: "REMOTO",
      ubicacion: null,
      enlace: "https://andes.example",
    });
  });

  it("si la función falla: feed vacío y queda registrado", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", { error: { message: "statement timeout" } });

    expect(await getComunidadFeed({ categoria: "PREGUNTAS" })).toEqual({ posts: [], pagina: 1, totalPaginas: 1 });
    expect(logError).toHaveBeenCalledWith(
      "comunidad:feed",
      "no se pudo leer el feed de comunidad",
      { message: "statement timeout" },
      { opciones: { categoria: "PREGUNTAS" } },
    );
  });
});

describe("getComunidadDestacados", () => {
  it("pide 4 de los últimos 7 días a la base y no cuenta nada en Node", async () => {
    servidorFalso.responder("rpc:comunidad_mas_respondidas", {
      data: [{ id: "p1", slug: "uno", titulo: "Uno", total_respuestas: "9" }],
    });

    expect(await getComunidadDestacados()).toEqual([{ id: "p1", slug: "uno", titulo: "Uno", totalRespuestas: 9 }]);
    expect(servidorFalso.argumentosDe("rpc:comunidad_mas_respondidas")).toEqual({ p_dias: 7, p_limite: 4 });
    expect(servidorFalso.llamadasA("from:comunidad_posts")).toHaveLength(0);
    expect(servidorFalso.llamadasA("from:comunidad_respuestas")).toHaveLength(0);
  });

  it("si falla, riel vacío y queda registrado", async () => {
    servidorFalso.responder("rpc:comunidad_mas_respondidas", { error: { message: "x" } });

    expect(await getComunidadDestacados()).toEqual([]);
    expect(logError).toHaveBeenCalledWith("comunidad:destacados", "no se pudieron leer los destacados", { message: "x" }, {});
  });
});
