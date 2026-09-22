import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * `getSituacionExamen` ante un fallo de la base (AUDIT-2026-09-22.md,
 * seguimiento de P2-3). Por defecto degrada a SIN_EXAMEN, que oculta el
 * recuadro del examen en la ficha y en la última clase; con `estricto` (la
 * página del examen) lanza. Antes un fallo al leer los intentos seguía con
 * una lista vacía y salía DISPONIBLE con 0 intentos usados, también para
 * quien ya había aprobado.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { getSituacionExamen } = await import("@/lib/examen");
const { logError } = await import("@/lib/log");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const EXAMEN = { id: "e1", titulo: "Examen final", instrucciones: null, intentos_maximos: 3, minutos_limite: 30 };
const APROBADO = { id: "i1", estado: "APROBADO", puntaje_pct: "100", finalizado_en: "2026-09-01T00:00:00Z", expira_en: null };

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
  servidorFalso.responder("from:examenes", { data: EXAMEN, error: null });
});

describe("getSituacionExamen", () => {
  it("aprobado con certificado: APROBADO y certificadoListo, contando solo los certificados PROPIOS", async () => {
    servidorFalso.responder("from:intentos_examen", { data: [APROBADO], error: null });
    servidorFalso.responder("from:certificados", { count: 1, error: null });

    expect(await getSituacionExamen("k1", "u1")).toMatchObject({ situacion: "APROBADO", certificadoListo: true });
    // La policy le abre al administrador los certificados de todos.
    const filtros = servidorFalso.encadenado("from:certificados", "eq");
    expect(filtros).toContainEqual(["id_usuario", "u1"]);
  });

  it("si fallan los intentos: SIN_EXAMEN y registrado (antes: DISPONIBLE con 0 intentos usados)", async () => {
    servidorFalso.responder("from:intentos_examen", { data: null, error: ERROR_PG });

    expect(await getSituacionExamen("k1", "u1")).toEqual({ situacion: "SIN_EXAMEN" });
    expect(logError).toHaveBeenCalledWith(
      "examen",
      "getSituacionExamen: la consulta de intentos_examen falló",
      ERROR_PG,
      expect.anything(),
    );
  });

  it("si falla el conteo de certificados: SIN_EXAMEN (antes: 'termina tus clases' a quien ya lo tenía)", async () => {
    servidorFalso.responder("from:intentos_examen", { data: [APROBADO], error: null });
    servidorFalso.responder("from:certificados", { count: null, error: ERROR_PG });

    expect(await getSituacionExamen("k1", "u1")).toEqual({ situacion: "SIN_EXAMEN" });
  });

  it("si falla el examen: SIN_EXAMEN y registrado (el comportamiento de siempre)", async () => {
    servidorFalso.responder("from:examenes", { data: null, error: ERROR_PG });

    expect(await getSituacionExamen("k1", "u1")).toEqual({ situacion: "SIN_EXAMEN" });
    expect(logError).toHaveBeenCalledOnce();
  });

  it.each([
    ["examenes", "from:examenes"],
    ["intentos_examen", "from:intentos_examen"],
    ["certificados", "from:certificados"],
  ])("estricto: si falla %s, LANZA en vez de degradar", async (tabla, operacion) => {
    servidorFalso.responder("from:intentos_examen", { data: [APROBADO], error: null });
    servidorFalso.responder(operacion, { data: null, count: null, error: ERROR_PG });

    await expect(getSituacionExamen("k1", "u1", { estricto: true })).rejects.toThrow(
      new RegExp(`getSituacionExamen:${tabla} falló.*57014`),
    );
  });

  it("estricto y sin fallos: la misma respuesta que sin estricto", async () => {
    servidorFalso.responder("from:intentos_examen", { data: [], error: null });

    expect(await getSituacionExamen("k1", "u1", { estricto: true })).toMatchObject({
      situacion: "DISPONIBLE",
      intentosUsados: 0,
      intentosRestantes: 3,
    });
  });
});
