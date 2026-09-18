import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/examenes/congelar", () => ({ congelarPreguntas: vi.fn() }));

import { enviarIntento, iniciarIntento, responderPregunta } from "@/actions/examenes/intento";
import { congelarPreguntas } from "@/lib/examenes/congelar";
import { VIDAS_INICIALES } from "@/lib/examenes/tipos";
import type { PreguntaCongelada, ProgresoIntento, RespuestasIntento } from "@/lib/examenes/tipos";

/**
 * Intentos de examen — AUDIT-2026-09-15.md, P2-8 Fase 3, extendido con el
 * sistema de vidas y la COLA DE REINTENTOS.
 *
 * `responderPregunta` y `enviarIntento` escriben con SERVICE ROLE (el
 * estudiante no tiene policy de UPDATE sobre `intentos_examen`, a propósito:
 * si la tuviera podría escribirse `puntaje_pct` a mano). Consecuencia: RLS no
 * protege nada aquí. Las únicas barreras son la comparación de `id_usuario`
 * y los filtros `.eq("id_usuario", …)` / `.eq("estado", "EN_CURSO")` que
 * escribe esta capa. Si un refactor quita uno, un estudiante puede enviar o
 * sobrescribir el intento de otro, y ninguna prueba de RLS lo vería.
 *
 * Regla de negocio que se prueba acá (docs/functional-spec.md Módulo 9):
 * fallar una pregunta cuesta una vida y la manda al FINAL de la cola de
 * pendientes; el intento solo cierra al quedarse sin vidas (REPROBADO) o al
 * responderlas TODAS correctamente (APROBADO). No hay criterio por
 * porcentaje.
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
    paresIzquierda: null,
    paresDerecha: null,
  };
}

/** El JSONB de `intentos_examen.respuestas` tal como vive hoy: progreso, no
 * un Record plano de respuestas. */
function progreso(
  cola: string[],
  resueltas: RespuestasIntento = {},
  fallos = 0,
): ProgresoIntento {
  return { resueltas, fallos, cola };
}

const INTENTO = {
  id: "intento-1",
  id_usuario: ESTUDIANTE.id,
  estado: "EN_CURSO",
  preguntas_congeladas: [pregunta(P1), pregunta(P2)],
  respuestas: progreso([P1, P2]) as unknown,
  expira_en: null as string | null,
  examen: { id_curso: "curso-1" },
};

/** Un `expira_en` ya vencido — lo que `enviarIntento` exige para poder
 * cerrar (ver el describe de `enviarIntento`, que lo usa por defecto salvo
 * que un test necesite probar específicamente lo contrario). */
const EXPIRADO = new Date(Date.now() - 60_000).toISOString();

/** Filtros `.eq` del UPDATE (la segunda llamada a la tabla). */
function filtrosDelUpdate(): unknown[][] {
  const [, update] = servidorFalso.llamadasA("from:intentos_examen");
  return update.cadena.filter((c) => c.metodo === "eq").map((c) => c.argumentos);
}

/** Lo que se mandó en el `.update({...})`. */
function filaActualizada(): Record<string, unknown> {
  const [, update] = servidorFalso.llamadasA("from:intentos_examen");
  return update.cadena.find((c) => c.metodo === "update")?.argumentos[0] as Record<string, unknown>;
}

/** El progreso persistido en ese UPDATE. */
function progresoGuardado(): ProgresoIntento {
  return filaActualizada().respuestas as ProgresoIntento;
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  vi.mocked(congelarPreguntas).mockReset();
});

describe("enviarIntento (cierre por vencimiento del cronómetro)", () => {
  // `expira_en` vencido por defecto en este describe: es el caso que
  // `enviarIntento` existe para atender. El test de "todavía no se agotó"
  // lo pisa explícitamente con uno futuro.
  function conIntento(
    intento: Partial<typeof INTENTO> = {},
    update: { count?: number; error?: unknown } = { count: 1 },
  ) {
    servidorFalso.responderEnOrden("from:intentos_examen", [
      { data: { ...INTENTO, expira_en: EXPIRADO, ...intento } },
      update,
    ]);
    servidorFalso.responder("from:cursos", { data: { slug: "revit-basico" } });
  }

  it("sin sesión no crea el cliente de Service Role", async () => {
    servidorFalso.conUsuario(null);

    expect((await enviarIntento("intento-1")).error).toMatch(/sesión expiró/);
    expect(servidorFalso.clientesCreados.admin).toBe(0);
  });

  it("el intento de OTRO estudiante: no lo cierra ni lo toca", async () => {
    conIntento({ id_usuario: "otra-persona" });

    expect(await enviarIntento("intento-1")).toEqual({ error: "No encontramos ese intento." });
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("un intento ya cerrado no se vuelve a cerrar", async () => {
    conIntento({ estado: "REPROBADO" });

    expect(await enviarIntento("intento-1")).toEqual({ error: "Este intento ya fue enviado." });
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
  });

  it("el corte por tiempo SIEMPRE reprueba, aunque tuviera casi todo resuelto", async () => {
    // Consecuencia directa de quitar el criterio por nota: la única forma de
    // aprobar es vaciar la cola, y quien llega acá la dejó a medias.
    conIntento({ respuestas: progreso([P2], { [P1]: "a" }) });

    const resultado = await enviarIntento("intento-1");

    expect(resultado).toEqual({ success: true, aprobado: false, puntajePct: 50 });
    const [, update] = servidorFalso.llamadasA("from:intentos_examen");
    expect(update.cliente).toBe("admin");
    expect(filaActualizada()).toMatchObject({ estado: "REPROBADO", puntaje_pct: 50 });
    // Cierra con lo ya persistido, sin inventar nada.
    expect(progresoGuardado()).toEqual(progreso([P2], { [P1]: "a" }));
    expect(filtrosDelUpdate()).toEqual([
      ["id", "intento-1"],
      ["id_usuario", ESTUDIANTE.id],
      ["estado", "EN_CURSO"],
    ]);
    expect(servidorFalso.revalidaciones).toEqual(
      expect.arrayContaining(["/dashboard/certificados", "/cursos/revit-basico", "/cursos/revit-basico/examen"]),
    );
  });

  it("sin nada resuelto, el puntaje informativo es 0 y reprueba igual", async () => {
    conIntento({ respuestas: progreso([P1, P2]) });

    expect(await enviarIntento("intento-1")).toMatchObject({ aprobado: false, puntajePct: 0 });
  });

  it("si el UPDATE no afectó filas (doble cierre en carrera), no se reporta como éxito", async () => {
    conIntento({}, { count: 0 });

    expect(await enviarIntento("intento-1")).toEqual({ error: "Este intento ya fue enviado." });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("valida `expira_en` en el servidor: si todavía no venció, rechaza y NO cierra el intento", async () => {
    // Reloj del navegador adelantado (dispara el tick antes de tiempo): el
    // servidor tiene que rechazarlo igual, sin confiar en que la llamada
    // llegó justo al vencimiento.
    conIntento({ expira_en: new Date(Date.now() + 5 * 60_000).toISOString() });

    expect(await enviarIntento("intento-1")).toEqual({ error: "El tiempo del examen todavía no se agotó." });
    // Ni siquiera se intenta el UPDATE: solo se leyó el intento.
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("dentro de la tolerancia de 30s ya se considera vencido", async () => {
    conIntento({ expira_en: new Date(Date.now() - 10_000).toISOString() });

    expect(await enviarIntento("intento-1")).toMatchObject({ success: true });
  });
});

describe("responderPregunta", () => {
  function conIntento(intento: Partial<typeof INTENTO> = {}, updates: { count?: number; error?: unknown }[] = [{ count: 1 }]) {
    servidorFalso.responderEnOrden("from:intentos_examen", [{ data: { ...INTENTO, ...intento } }, ...updates]);
    servidorFalso.responder("from:cursos", { data: { slug: "revit-basico" } });
  }

  it("sin sesión no crea el cliente de Service Role", async () => {
    servidorFalso.conUsuario(null);

    expect(await responderPregunta("intento-1", P1, "a")).toMatchObject({ error: expect.stringMatching(/sesión expiró/) });
    expect(servidorFalso.clientesCreados.admin).toBe(0);
  });

  it("respuesta correcta: no resta vida, saca la pregunta de la cola y sigue EN_CURSO", async () => {
    conIntento();

    const resultado = await responderPregunta("intento-1", P1, "a");

    expect(resultado).toEqual({
      success: true,
      acierto: true,
      vidasRestantes: VIDAS_INICIALES,
      cerrado: false,
      siguientePreguntaId: P2,
    });
    expect(filaActualizada()).toEqual({ respuestas: progreso([P2], { [P1]: "a" }) });
  });

  it("respuesta incorrecta con vidas de sobra: no cierra, la pregunta vuelve al FINAL de la cola", async () => {
    // Lo que define la regla nueva: no se repite en el acto (la siguiente es
    // P2, no P1 otra vez), no se guarda la respuesta mala, y el fallo queda
    // contado aparte para que las vidas no dependan de `resueltas`.
    conIntento();

    const resultado = await responderPregunta("intento-1", P1, "b");

    expect(resultado).toEqual({
      success: true,
      acierto: false,
      vidasRestantes: VIDAS_INICIALES - 1,
      cerrado: false,
      siguientePreguntaId: P2,
    });
    expect(progresoGuardado()).toEqual({ resueltas: {}, fallos: 1, cola: [P2, P1] });
  });

  it("con 3 preguntas, fallar la primera deja el orden exacto pregunta2, pregunta3, pregunta1", async () => {
    const preguntas = ["q1", "q2", "q3"].map((id) => pregunta(id));
    conIntento({ preguntas_congeladas: preguntas, respuestas: progreso(["q1", "q2", "q3"]) });

    const resultado = await responderPregunta("intento-1", "q1", "b");

    expect(resultado).toMatchObject({ acierto: false, cerrado: false, siguientePreguntaId: "q2" });
    expect(progresoGuardado().cola).toEqual(["q2", "q3", "q1"]);
  });

  it("acertar la pregunta REINTENTADA cierra el intento como aprobado si era la última pendiente", async () => {
    // Estado tras haber fallado q1 y acertado q2 y q3: solo queda el
    // reintento de q1.
    const preguntas = ["q1", "q2", "q3"].map((id) => pregunta(id));
    conIntento({
      preguntas_congeladas: preguntas,
      respuestas: progreso(["q1"], { q2: "a", q3: "a" }, 1),
    });

    const resultado = await responderPregunta("intento-1", "q1", "a");

    expect(resultado).toEqual({
      success: true,
      acierto: true,
      vidasRestantes: VIDAS_INICIALES - 1,
      cerrado: true,
      aprobado: true,
      puntajePct: 100,
    });
    expect(filaActualizada()).toMatchObject({
      estado: "APROBADO",
      puntaje_pct: 100,
      finalizado_en: expect.any(String),
    });
    expect(progresoGuardado().cola).toEqual([]);
  });

  it("vaciar la cola es la ÚNICA forma de aprobar: responder bien todas cierra APROBADO", async () => {
    conIntento({ respuestas: progreso([P2], { [P1]: "a" }) });

    const resultado = await responderPregunta("intento-1", P2, "a");

    expect(resultado).toEqual({
      success: true,
      acierto: true,
      vidasRestantes: VIDAS_INICIALES,
      cerrado: true,
      aprobado: true,
      puntajePct: 100,
    });
  });

  it("un fallo real de escritura al cerrar se distingue de un cierre concurrente", async () => {
    // Sin `count`, con `error`: un fallo transitorio de la base, no una
    // carrera. El mensaje debe invitar a reintentar, no decir que ya se
    // envió — porque no se envió, y la respuesta actual se perdería si el
    // estudiante creyera lo contrario y no reintentara.
    conIntento({ respuestas: progreso([P2], { [P1]: "a" }) }, [{ error: { message: "timeout" } }]);

    expect(await responderPregunta("intento-1", P2, "a")).toEqual({
      error: "No pudimos guardar tu respuesta. Intenta de nuevo.",
    });
  });

  it("un cierre concurrente (0 filas, sin error) sí dice que el intento ya fue enviado", async () => {
    conIntento({ respuestas: progreso([P2], { [P1]: "a" }) }, [{ count: 0 }]);

    expect(await responderPregunta("intento-1", P2, "a")).toEqual({ error: "Este intento ya fue enviado." });
  });

  it("un fallo real de escritura en una respuesta que NO cierra también se distingue", async () => {
    conIntento({}, [{ error: { message: "timeout" } }]);

    expect(await responderPregunta("intento-1", P1, "a")).toEqual({
      error: "No pudimos guardar tu respuesta. Intenta de nuevo.",
    });
  });

  it("agotar las vidas cierra REPROBADO YA, aunque queden preguntas en la cola", async () => {
    // 10 preguntas: 5 resueltas, 4 vidas ya gastadas, y esta respuesta falla
    // la quinta. Quedan 4 pendientes en la cola (más el reintento de la que
    // acaba de fallar): la regla de vidas le gana a todo lo demás.
    const ids = Array.from({ length: 10 }, (_, i) => `q${i + 1}`);
    const preguntas = ids.map((id) => pregunta(id));
    conIntento({
      preguntas_congeladas: preguntas,
      respuestas: progreso(
        ids.slice(5),
        Object.fromEntries(ids.slice(0, 5).map((id) => [id, "a"])),
        VIDAS_INICIALES - 1,
      ),
    });

    const resultado = await responderPregunta("intento-1", ids[5], "b");

    expect(resultado).toEqual({
      success: true,
      acierto: false,
      vidasRestantes: 0,
      cerrado: true,
      aprobado: false,
      puntajePct: 50,
    });
    expect(filaActualizada()).toMatchObject({
      estado: "REPROBADO",
      puntaje_pct: 50,
      finalizado_en: expect.any(String),
    });
    // Se cierra con la cola a medias, no vacía: el cierre no espera a que
    // termine el examen.
    expect(progresoGuardado().cola.length).toBeGreaterThan(0);
  });

  it("responder una pregunta YA RESUELTA es idempotente: no resta vida ni reordena la cola", async () => {
    conIntento({ respuestas: progreso([P2], { [P1]: "a" }, 1) }, []);

    const resultado = await responderPregunta("intento-1", P1, "a");

    expect(resultado).toEqual({
      success: true,
      acierto: true,
      vidasRestantes: VIDAS_INICIALES - 1,
      cerrado: false,
      siguientePreguntaId: P2,
    });
    // Ningún UPDATE: solo se leyó el intento, se devolvió lo ya calculado.
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
  });

  it("responder fuera de orden (saltarse el frente de la cola) se rechaza", async () => {
    conIntento({}, []);

    expect(await responderPregunta("intento-1", P2, "a")).toEqual({ error: "Responde las preguntas en orden." });
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
  });

  it("tampoco se puede responder una pregunta que ya salió del frente al fallarla", async () => {
    // P1 se falló y se fue al final: el frente ahora es P2. Volver a mandar
    // P1 no puede adelantar su reintento.
    conIntento({ respuestas: progreso([P2, P1], {}, 1) }, []);

    expect(await responderPregunta("intento-1", P1, "a")).toEqual({ error: "Responde las preguntas en orden." });
  });

  it("una pregunta que no existe en el intento se rechaza", async () => {
    conIntento({}, []);

    expect(await responderPregunta("intento-1", "no-existe", "a")).toEqual({
      error: "Esa pregunta no existe en este intento.",
    });
  });

  it("tiempo ya vencido: cierra REPROBADO con lo ya persistido, sin contar esta respuesta nueva", async () => {
    conIntento({ expira_en: new Date(Date.now() - 5 * 60_000).toISOString(), respuestas: progreso([P2], { [P1]: "a" }) });

    const resultado = await responderPregunta("intento-1", P2, "a");

    expect(resultado).toMatchObject({ success: true, cerrado: true, porTiempo: true, aprobado: false });
    // La respuesta a P2 que llegó en esta llamada NO entra al cierre.
    expect(progresoGuardado()).toEqual(progreso([P2], { [P1]: "a" }));
  });

  it("el intento de OTRO estudiante no se toca", async () => {
    conIntento({ id_usuario: "otra-persona" }, []);

    expect(await responderPregunta("intento-1", P1, "a")).toEqual({ error: "No encontramos ese intento." });
    expect(servidorFalso.llamadasA("from:intentos_examen")).toHaveLength(1);
  });

  it("un intento ya cerrado se rechaza", async () => {
    conIntento({ estado: "APROBADO" }, []);

    expect(await responderPregunta("intento-1", P1, "a")).toEqual({ error: "Este intento ya fue enviado." });
  });

  it("respuesta con forma inválida no llega a leer el intento", async () => {
    const invalida = ["x".repeat(65)];

    expect(await responderPregunta("intento-1", P1, invalida)).toEqual({ error: "Respuesta inválida." });
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

  it("sin terminar las clases del curso, igual puede presentarlo (acceso ya no exige 100% de lecciones)", async () => {
    servidorFalso.responderEnOrden("from:intentos_examen", [{ data: [] }, { data: { id: "nuevo" } }]);

    expect(await iniciarIntento("curso-1")).toEqual({ success: true, intentoId: "nuevo" });
    expect(congelarPreguntas).toHaveBeenCalled();
  });

  it("en enfriamiento tras un intento reciente, no abre otro", async () => {
    servidorFalso.responder("from:intentos_examen", {
      data: [{ id: "i-1", estado: "REPROBADO", finalizado_en: new Date(Date.now() - 60_000).toISOString() }],
    });

    expect((await iniciarIntento("curso-1")).error).toMatch(/Puedes volver a intentarlo a partir de las/);
    expect(insercion()).toBeUndefined();
  });

  it("crea el intento con el usuario de la sesión y la cola en el orden congelado", async () => {
    servidorFalso.responderEnOrden("from:intentos_examen", [{ data: [] }, { data: { id: "nuevo" } }]);

    expect(await iniciarIntento("curso-1")).toEqual({ success: true, intentoId: "nuevo" });
    expect(insercion()).toMatchObject({
      id_examen: "examen-1",
      id_usuario: ESTUDIANTE.id,
      nota_requerida: 80,
      preguntas_congeladas: [pregunta(P1)],
      // La cola arranca con TODAS las preguntas, en el orden que le tocó a
      // este estudiante — nada resuelto y sin fallos.
      respuestas: { resueltas: {}, fallos: 0, cola: [P1] },
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
