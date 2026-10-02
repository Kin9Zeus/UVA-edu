import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Cifras de la portada y el login (Notion: "Front: corregir cifras y
 * funciones anunciadas que no son reales"). Lo que importa: ninguna cifra se
 * muestra por debajo de su mínimo, y si la base falla el bloque se oculta en
 * vez de salir con un número vacío.
 */
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/supabase/public", () => import("@/test/servidor-falso").then((m) => m.moduloSupabasePublic()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { armarCifras, getCifrasPublicas } = await import("@/lib/cifrasPublicas");
const { MINIMOS_CIFRAS } = await import("@/content/marketing");
const { logError } = await import("@/lib/log");

/** `n` cursos publicados, cada uno en la escuela que diga `escuelaDe(i)`. */
function cursos(n: number, escuelaDe: (i: number) => string | null) {
  return Array.from({ length: n }, (_, i) => ({
    id: `curso-${i}`,
    curso_categorias: [{ categoria: escuelaDe(i) === null ? null : { id: escuelaDe(i) } }],
  }));
}

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
});

describe("armarCifras", () => {
  it("no muestra ninguna cifra por debajo de su mínimo", () => {
    expect(
      armarCifras({
        cursosPublicados: MINIMOS_CIFRAS.cursosPublicados - 1,
        escuelasConCursos: MINIMOS_CIFRAS.escuelasConCursos - 1,
      }),
    ).toEqual([]);
  });

  it("muestra cada cifra desde su mínimo, con separador de miles", () => {
    expect(armarCifras({ cursosPublicados: 1200, escuelasConCursos: MINIMOS_CIFRAS.escuelasConCursos })).toEqual([
      { valor: "1.200", etiqueta: "cursos publicados" },
      { valor: String(MINIMOS_CIFRAS.escuelasConCursos), etiqueta: "escuelas" },
    ]);
  });

  it("evalúa cada cifra por separado", () => {
    expect(
      armarCifras({ cursosPublicados: MINIMOS_CIFRAS.cursosPublicados, escuelasConCursos: 1 }).map((c) => c.etiqueta),
    ).toEqual(["cursos publicados"]);
  });
});

describe("getCifrasPublicas", () => {
  it("cuenta escuelas distintas e ignora las categorías inactivas (llegan como null)", async () => {
    // 12 cursos repartidos en 5 escuelas activas; los múltiplos de 4 caen en una inactiva.
    servidorFalso.responder("from:cursos", {
      data: cursos(12, (i) => (i % 4 === 0 ? null : `escuela-${i % 5}`)),
      error: null,
    });

    expect(await getCifrasPublicas()).toEqual([
      { valor: "12", etiqueta: "cursos publicados" },
      { valor: "5", etiqueta: "escuelas" },
    ]);
  });

  it("con la base de hoy (1 curso, 4 escuelas) no muestra nada", async () => {
    servidorFalso.responder("from:cursos", { data: cursos(1, () => "escuela-1"), error: null });

    expect(await getCifrasPublicas()).toEqual([]);
  });

  it("si la consulta falla, oculta las cifras y lo registra", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: { message: "timeout", code: "57014" } });

    expect(await getCifrasPublicas()).toEqual([]);
    expect(logError).toHaveBeenCalledOnce();
  });
});
