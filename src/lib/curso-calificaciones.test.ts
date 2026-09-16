import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso, type LlamadaRegistrada } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));

import { getCalificacionesCurso, getTandaCalificacionesCurso, RESENAS_POR_TANDA } from "@/lib/curso-calificaciones";

/**
 * Reseñas de curso por tandas — AUDIT-2026-09-15.md, P2-10 (Fase 2).
 *
 * Antes la ficha pública traía TODAS las reseñas del curso con TODAS sus
 * reacciones en cada visita. Lo que se protege aquí: que se pida una tanda
 * acotada con un orden estable, que las reacciones y autores se pidan solo
 * para esa tanda, y que la reseña propia siga apareciendo aunque no caiga
 * en la primera tanda.
 */

const CURSO = "11111111-1111-4111-8111-111111111111";
const ESTUDIANTE = "estudiante-1";

function filaReseña(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `cal-${n}`,
    id_usuario: `autor-${n}`,
    puntuacion: 5,
    comentario: `Comentario ${n}`,
    creado_en: "2026-09-10T12:00:00Z",
    ...extra,
  };
}

function filas(desde: number, cuantas: number) {
  return Array.from({ length: cuantas }, (_, i) => filaReseña(desde + i));
}

const esFilaUnica = (llamada: LlamadaRegistrada) => llamada.cadena.some((c) => c.metodo === "maybeSingle");

beforeEach(() => {
  servidorFalso.reiniciar();
});

describe("getTandaCalificacionesCurso", () => {
  it("pide una tanda + 1 fila, de la más reciente a la más antigua, con desempate estable", async () => {
    await getTandaCalificacionesCurso(CURSO, null, 18);

    const [consulta] = servidorFalso.llamadasA("from:curso_calificaciones");
    expect(consulta.cadena).toEqual([
      { metodo: "select", argumentos: ["id, id_usuario, puntuacion, comentario, creado_en"] },
      { metodo: "eq", argumentos: ["id_curso", CURSO] },
      { metodo: "eq", argumentos: ["eliminado", false] },
      { metodo: "order", argumentos: ["creado_en", { ascending: false }] },
      { metodo: "order", argumentos: ["id", { ascending: false }] },
      // `range` es inclusivo: 18..27 son 10 filas = una tanda de 9 + 1 para saber si hay más.
      { metodo: "range", argumentos: [18, 18 + RESENAS_POR_TANDA] },
    ]);
  });

  it("con una fila de más: devuelve 9 y avisa que hay otra tanda", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: filas(0, RESENAS_POR_TANDA + 1) });

    const tanda = await getTandaCalificacionesCurso(CURSO, null, 0);

    expect(tanda.reseñas).toHaveLength(RESENAS_POR_TANDA);
    expect(tanda.hayMas).toBe(true);
  });

  it("sin fila de más: es la última tanda", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: filas(0, 4) });

    expect((await getTandaCalificacionesCurso(CURSO, null, 0)).hayMas).toBe(false);
  });

  it("autores y reacciones se piden solo para las reseñas de la tanda, no para la fila extra", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: filas(0, RESENAS_POR_TANDA + 1) });

    await getTandaCalificacionesCurso(CURSO, null, 0);

    const idsTanda = filas(0, RESENAS_POR_TANDA).map((f) => f.id);
    expect(servidorFalso.encadenado("from:curso_calificacion_reacciones", "in")).toEqual([["id_calificacion", idsTanda]]);
    expect(servidorFalso.encadenado("from:curso_calificacion_autor_publico", "in")[0][1]).toHaveLength(RESENAS_POR_TANDA);
  });

  it("tanda vacía: no pide autores ni reacciones", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: [] });

    expect(await getTandaCalificacionesCurso(CURSO, null, 90)).toEqual({ reseñas: [], hayMas: false });
    expect(servidorFalso.operaciones()).toEqual(["from:curso_calificaciones"]);
  });

  it("arma cada reseña con autor, conteo de me gusta y el me gusta propio", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: [filaReseña(1), filaReseña(2)] });
    servidorFalso.responder("from:curso_calificacion_autor_publico", {
      data: [{ id: "autor-1", nombre: "Ana Ruiz", foto_url: "https://foto/ana.webp" }],
    });
    servidorFalso.responder("from:curso_calificacion_reacciones", {
      data: [
        { id_calificacion: "cal-1", id_usuario: ESTUDIANTE },
        { id_calificacion: "cal-1", id_usuario: "otro" },
        { id_calificacion: "cal-2", id_usuario: "otro" },
      ],
    });

    const { reseñas } = await getTandaCalificacionesCurso(CURSO, ESTUDIANTE, 0);

    expect(reseñas[0]).toMatchObject({
      id: "cal-1",
      autorNombre: "Ana Ruiz",
      autorFotoUrl: "https://foto/ana.webp",
      totalMeGusta: 2,
      meGusta: true,
    });
    // Autor que la vista no devuelve (p. ej. anonimizado): nombre genérico.
    expect(reseñas[1]).toMatchObject({ autorNombre: "Estudiante UVA", totalMeGusta: 1, meGusta: false });
  });
});

describe("getCalificacionesCurso", () => {
  it("promedio y total salen del resumen; la lista es solo la primera tanda", async () => {
    servidorFalso.responder("from:curso_calificaciones_resumen", { data: { promedio: 4.5, total: 40 } });
    servidorFalso.responder("from:curso_calificaciones", { data: filas(0, RESENAS_POR_TANDA + 1) });

    const datos = await getCalificacionesCurso(CURSO, null);

    expect(datos).toMatchObject({ promedio: 4.5, total: 40, hayMas: true, miCalificacion: null });
    expect(datos.reseñas).toHaveLength(RESENAS_POR_TANDA);
  });

  it("sin sesión no busca reseña propia", async () => {
    await getCalificacionesCurso(CURSO, null);

    expect(servidorFalso.encadenado("from:curso_calificaciones", "maybeSingle")).toEqual([]);
  });

  it("la reseña propia que no está en la primera tanda se consulta aparte y se completa", async () => {
    // Sin esto, alguien con una reseña antigua vería el formulario vacío y,
    // al publicar, EDITARÍA la suya creyendo que creaba otra.
    servidorFalso.responderSegun("from:curso_calificaciones", (llamada) =>
      esFilaUnica(llamada)
        ? { data: filaReseña(99, { id_usuario: ESTUDIANTE, puntuacion: 3 }) }
        : { data: filas(0, RESENAS_POR_TANDA) },
    );

    const { miCalificacion } = await getCalificacionesCurso(CURSO, ESTUDIANTE);

    expect(miCalificacion).toMatchObject({ id: "cal-99", autorId: ESTUDIANTE, puntuacion: 3 });
    const propia = servidorFalso.llamadasA("from:curso_calificaciones").find(esFilaUnica)!;
    expect(propia.cadena.filter((c) => c.metodo === "eq")).toEqual([
      { metodo: "eq", argumentos: ["id_curso", CURSO] },
      { metodo: "eq", argumentos: ["id_usuario", ESTUDIANTE] },
      { metodo: "eq", argumentos: ["eliminado", false] },
    ]);
    expect(servidorFalso.encadenado("from:curso_calificacion_reacciones", "in")).toContainEqual([
      "id_calificacion",
      ["cal-99"],
    ]);
  });

  it("si la reseña propia ya está en la primera tanda, la reutiliza sin volver a completarla", async () => {
    servidorFalso.responderSegun("from:curso_calificaciones", (llamada) =>
      esFilaUnica(llamada)
        ? { data: filaReseña(2, { id_usuario: ESTUDIANTE }) }
        : { data: [filaReseña(1), filaReseña(2, { id_usuario: ESTUDIANTE })] },
    );

    const { miCalificacion, reseñas } = await getCalificacionesCurso(CURSO, ESTUDIANTE);

    expect(miCalificacion).toBe(reseñas[1]);
    expect(servidorFalso.llamadasA("from:curso_calificacion_reacciones")).toHaveLength(1);
  });

  it("sin reseñas: total 0 y promedio null (el JSON-LD omite aggregateRating)", async () => {
    servidorFalso.responder("from:curso_calificaciones_resumen", { data: null });

    expect(await getCalificacionesCurso(CURSO, null)).toEqual({
      promedio: null,
      total: 0,
      reseñas: [],
      hayMas: false,
      miCalificacion: null,
    });
  });
});
