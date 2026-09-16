import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/examenes/congelar", () => ({ congelarPreguntas: vi.fn() }));

import { enviarIntento, guardarRespuestas, iniciarIntento } from "@/actions/examenes/intento";
import { congelarPreguntas } from "@/lib/examenes/congelar";
import type { PreguntaCongelada } from "@/lib/examenes/tipos";

/**
 * Intentos de examen — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * `guardarRespuestas` y `enviarIntento` escriben con SERVICE ROLE (el
 * estudiante no tiene policy de UPDATE sobre `intentos_examen`, a propósito:
 * si la tuviera podría escribirse `puntaje_pct` a mano). Consecuencia: RLS no
 * protege nada aquí. Las únicas barreras son la comparación de `id_usuario`
 * y los filtros `.eq("id_usuario", …)` / `.eq("estado", "EN_CURSO")` que
 * escribe esta capa. Si un refactor quita uno, un estudiante puede enviar o
 * sobrescribir el intento de otro, y ninguna prueba de RLS lo vería.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function pregunta(id: string): PreguntaCongelada {
  return {
    id,
    tipo: "OPCION_UNICA",
    enunciado: {} as PreguntaCongelada["enunciado"],
    puntos: 1,
    opciones: [
      { id: "a", texto: "Correcta", correcta: true },
      { id: "b", texto: "Incorrecta", correcta: false },
    ],
    respuestasAceptadas: [],
  };
}

const INTENTO = {
  id: "intento-1",
  id_usuario: ESTUDIANTE.id,
  estado: "EN_CURSO",
  nota_requerida: 75,
  preguntas_congeladas: [pregunta(P1), pregunta(P2)],
  respuestas: { [P1]: "a" },
  expira_en: null as string | null,
  examen: { id_curso: "curso-1" },
};

/** Filtros `.eq` del UPDATE (la segunda llamada a la tabla). */
function filtrosDelUpdate(): unknown[][] {
  const [, update] = servidorFalso.llamadasA("from:intentos_examen");
  return update.cadena.filter((c) => c.metodo === "eq").map((c) => c.argumentos);
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  vi.mocked(congelarPreguntas).mockReset();
});

describe("enviarIntento", () => {
  function conIntento(intento: Partial<typeof INTENTO>, update: { count?: number; error?: unknown } = { count: 1 }) {
    servidorFalso.responderEnOrden("from:intentos_examen", [{ data: { ...INTENTO, ...intento } }, update]);
    servidorFalso.responder("from:cursos", { data: { slug: "revit-basico" } });
  }

  it("sin sesión no crea el cliente de Service Role", async () => {
    servidorFalso.conUsuario(null);

    expect((await enviarIntento("intento-1", {})).error).toMatch(/sesión expiró/);
    expect(servidorFalso.clientesCreados.admin).toBe(0);
  });

  it("respuestas con forma inválida no llegan a leer el intento", async () => {
    const invalidas = { "no-es-uuid": "a" };

    expect(await enviarIntento("intento-1", invalidas)).toEqual({ error: "Respuestas inválidas." });
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(0);
  });

  it("el intento de OTRO estudiante: no lo califica ni lo toca", async () => {
    conIntento({ id_usuario: "otra-persona" });

    expect(await enviarIntento("intento-1", { [P1]: "a", [P2]: "a" })).toEqual({ error: "No encontramos ese intento." });
    // Mismo mensaje que "no existe": no confirma que el id sea válido.
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("un intento ya cerrado no se vuelve a calificar", async () => {
    conIntento({ estado: "REPROBADO" });

    expect(await enviarIntento("intento-1", { [P1]: "a", [P2]: "a" })).toEqual({ error: "Este intento ya fue enviado." });
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
  });

  it("califica en el servidor con las preguntas congeladas, y el UPDATE va filtrado por dueño y estado", async () => {
    conIntento({});

    const resultado = await enviarIntento("intento-1", { [P1]: "a", [P2]: "a" });

    expect(resultado).toEqual({ success: true, aprobado: true, puntajePct: 100, porTiempo: false });
    const [, update] = servidorFalso.llamadasA("from:intentos_examen");
    expect(update.cliente).toBe("admin");
    expect(update.cadena.find((c) => c.metodo === "update")?.argumentos[0]).toMatchObject({
      estado: "APROBADO",
      puntaje_pct: 100,
      respuestas: { [P1]: "a", [P2]: "a" },
    });
    expect(filtrosDelUpdate()).toEqual([
      ["id", "intento-1"],
      ["id_usuario", ESTUDIANTE.id],
      ["estado", "EN_CURSO"],
    ]);
    expect(servidorFalso.revalidaciones).toEqual(
      expect.arrayContaining(["/dashboard/certificados", "/cursos/revit-basico", "/cursos/revit-basico/examen"]),
    );
  });

  it("bajo la nota requerida queda REPROBADO", async () => {
    conIntento({});

    const resultado = await enviarIntento("intento-1", { [P1]: "a", [P2]: "b" });

    expect(resultado).toMatchObject({ aprobado: false, puntajePct: 50 });
    const [, update] = servidorFalso.llamadasA("from:intentos_examen");
    expect(update.cadena.find((c) => c.metodo === "update")?.argumentos[0]).toMatchObject({ estado: "REPROBADO" });
  });

  it("enviado fuera de tiempo: califica lo último guardado, no lo que llega ahora", async () => {
    // Sin esto, se podía dejar correr el reloj, buscar las respuestas y
    // mandarlas después: el envío tardío las completaría.
    conIntento({ expira_en: new Date(Date.now() - 5 * 60_000).toISOString() });

    const resultado = await enviarIntento("intento-1", { [P1]: "a", [P2]: "a" });

    expect(resultado).toEqual({ success: true, aprobado: false, puntajePct: 50, porTiempo: true });
    const [, update] = servidorFalso.llamadasA("from:intentos_examen");
    expect(update.cadena.find((c) => c.metodo === "update")?.argumentos[0]).toMatchObject({
      respuestas: { [P1]: "a" },
    });
  });

  it("dentro de la tolerancia de 30 s todavía cuenta lo que llega", async () => {
    conIntento({ expira_en: new Date(Date.now() - 10_000).toISOString() });

    expect(await enviarIntento("intento-1", { [P1]: "a", [P2]: "a" })).toMatchObject({ puntajePct: 100, porTiempo: false });
  });

  it("si el UPDATE no afectó filas (doble envío en carrera), no se reporta como éxito", async () => {
    conIntento({}, { count: 0 });

    expect(await enviarIntento("intento-1", { [P1]: "a", [P2]: "a" })).toEqual({ error: "Este intento ya fue enviado." });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });
});

describe("guardarRespuestas", () => {
  it("sin sesión no escribe", async () => {
    servidorFalso.conUsuario(null);

    expect(await guardarRespuestas("intento-1", { [P1]: "a" })).toEqual({ ok: false });
    expect(servidorFalso.clientesCreados.admin).toBe(0);
  });

  it("el UPDATE va filtrado por el dueño de la sesión y solo sobre un intento EN_CURSO", async () => {
    servidorFalso.responder("from:intentos_examen", { count: 1 });

    expect(await guardarRespuestas("intento-1", { [P1]: "a" })).toEqual({ ok: true });
    expect(servidorFalso.encadenado("from:intentos_examen", "eq")).toEqual([
      ["id", "intento-1"],
      ["id_usuario", ESTUDIANTE.id],
      ["estado", "EN_CURSO"],
    ]);
    expect(servidorFalso.encadenado("from:intentos_examen", "update")[0][0]).toEqual({ respuestas: { [P1]: "a" } });
  });

  it("si no afectó filas (intento ajeno o ya cerrado) responde ok:false", async () => {
    servidorFalso.responder("from:intentos_examen", { count: 0 });

    expect(await guardarRespuestas("intento-ajeno", { [P1]: "a" })).toEqual({ ok: false });
  });

  it("respuestas con forma inválida no se escriben", async () => {
    expect(await guardarRespuestas("intento-1", { [P1]: ["x".repeat(65)] })).toEqual({ ok: false });
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(0);
  });
});

describe("iniciarIntento", () => {
  const EXAMEN = {
    id: "examen-1",
    nota_aprobatoria: 80,
    intentos_maximos: 3,
    minutos_limite: 30,
    aleatorizar_preguntas: true,
    aleatorizar_opciones: false,
  };

  beforeEach(() => {
    servidorFalso.responder("from:examenes", { data: EXAMEN });
    servidorFalso.responder("rpc:lecciones_completas_curso", { data: true });
    vi.mocked(congelarPreguntas).mockResolvedValue([pregunta(P1)]);
  });

  function insercion(): Record<string, unknown> | undefined {
    return servidorFalso.encadenado("from:intentos_examen", "insert")[0]?.[0] as Record<string, unknown> | undefined;
  }

  it("quien ya aprobó no abre otro intento", async () => {
    servidorFalso.responder("from:intentos_examen", { data: [{ id: "i-0", estado: "APROBADO", finalizado_en: "2026-09-01" }] });

    expect(await iniciarIntento("curso-1")).toEqual({ error: "Ya aprobaste este examen." });
    expect(insercion()).toBeUndefined();
  });

  it("con un intento EN_CURSO lo retoma en vez de abrir otro", async () => {
    servidorFalso.responder("from:intentos_examen", { data: [{ id: "abierto", estado: "EN_CURSO", finalizado_en: null }] });

    expect(await iniciarIntento("curso-1")).toEqual({ success: true, intentoId: "abierto" });
    expect(insercion()).toBeUndefined();
  });

  it("sin terminar las clases no se puede presentar", async () => {
    servidorFalso.responder("from:intentos_examen", { data: [] });
    servidorFalso.responder("rpc:lecciones_completas_curso", { data: false });

    expect(await iniciarIntento("curso-1")).toEqual({
      error: "Termina todas las clases del curso antes de presentar el examen.",
    });
    expect(congelarPreguntas).not.toHaveBeenCalled();
  });

  it("en enfriamiento tras un intento reciente, no abre otro", async () => {
    servidorFalso.responder("from:intentos_examen", {
      data: [{ id: "i-1", estado: "REPROBADO", finalizado_en: new Date(Date.now() - 60_000).toISOString() }],
    });

    expect((await iniciarIntento("curso-1")).error).toMatch(/Puedes volver a intentarlo a partir de las/);
    expect(insercion()).toBeUndefined();
  });

  it("crea el intento con el usuario de la sesión y la nota del EXAMEN, no del cliente", async () => {
    servidorFalso.responderEnOrden("from:intentos_examen", [{ data: [] }, { data: { id: "nuevo" } }]);

    expect(await iniciarIntento("curso-1")).toEqual({ success: true, intentoId: "nuevo" });
    expect(insercion()).toMatchObject({
      id_examen: "examen-1",
      id_usuario: ESTUDIANTE.id,
      nota_requerida: 80,
      preguntas_congeladas: [pregunta(P1)],
      respuestas: {},
    });
    expect(servidorFalso.llamadasA("from:intentos_examen")[1].cliente).toBe("admin");
    expect(congelarPreguntas).toHaveBeenCalledWith("examen-1", true, false);
  });

  it("dos pestañas a la vez (UNIQUE 23505): devuelve el intento que ganó la carrera", async () => {
    servidorFalso.responderEnOrden("from:intentos_examen", [
      { data: [] },
      { error: { code: "23505", message: "duplicate" } },
      { data: { id: "el-otro" } },
    ]);

    expect(await iniciarIntento("curso-1")).toEqual({ success: true, intentoId: "el-otro" });
  });
});
