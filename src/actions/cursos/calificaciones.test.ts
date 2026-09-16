import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  calificarCurso,
  eliminarCalificacionPropia,
  moderarCalificacion,
  quitarReaccionCalificacion,
  reaccionarCalificacion,
} from "@/actions/cursos/calificaciones";
import { registrarBitacora } from "@/lib/admin/bitacora";

/**
 * Calificaciones de curso — AUDIT-2026-09-15.md, P2-9 Fase 1.
 *
 * RLS y el trigger de transiciones ya tienen su prueba contra la base real
 * (scripts/rls-test.ts). Lo que se prueba aquí es la capa TypeScript:
 *   · el autor sale de la sesión, nunca de un argumento;
 *   · una reseña por persona: si ya hay una activa se EDITA, no se inserta
 *     otra (el índice único es parcial y no admite upsert);
 *   · moderar exige admin, firma con el propio id y deja bitácora — solo si
 *     de verdad cambió una fila;
 *   · lo que se revalida lo decide el servidor, no el navegador.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const ADMIN = { id: "admin-9", email: "admin@uva.co" };

const SIN_SESION = { error: "Debes iniciar sesión." };

function escrituras() {
  return servidorFalso.llamadas.filter((l) =>
    l.cadena.some((c) => ["update", "insert", "delete", "upsert"].includes(c.metodo)),
  );
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  vi.mocked(registrarBitacora).mockReset();
  vi.mocked(revalidatePath).mockClear();
});

describe("sin sesión ninguna acción escribe ni revalida", () => {
  beforeEach(() => servidorFalso.conUsuario(null));

  it.each([
    ["calificarCurso", () => calificarCurso("curso-1", 5, "")],
    ["eliminarCalificacionPropia", () => eliminarCalificacionPropia("cal-1")],
    ["moderarCalificacion", () => moderarCalificacion("cal-1")],
    ["reaccionarCalificacion", () => reaccionarCalificacion("cal-1")],
    ["quitarReaccionCalificacion", () => quitarReaccionCalificacion("cal-1")],
  ])("%s", async (_nombre, accion) => {
    expect(await accion()).toEqual(SIN_SESION);
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
    expect(servidorFalso.revalidaciones).toEqual([]);
  });
});

describe("calificarCurso", () => {
  it("sin reseña activa: INSERT con el autor de la sesión", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: null });

    expect(await calificarCurso("curso-1", 4, "  Muy claro  ")).toEqual({ success: true });

    // La búsqueda de "la mía" filtra por la sesión y solo entre las activas:
    // una reseña autoeliminada no se reescribe, se crea otra.
    expect(servidorFalso.encadenado("from:curso_calificaciones", "eq")).toEqual([
      ["id_curso", "curso-1"],
      ["id_usuario", ESTUDIANTE.id],
      ["eliminado", false],
    ]);
    expect(servidorFalso.encadenado("from:curso_calificaciones", "insert")).toEqual([
      [{ id_curso: "curso-1", id_usuario: ESTUDIANTE.id, puntuacion: 4, comentario: "Muy claro" }],
    ]);
    expect(servidorFalso.encadenado("from:curso_calificaciones", "update")).toEqual([]);
  });

  it("con reseña activa: UPDATE de ESA fila, nunca un segundo INSERT", async () => {
    servidorFalso.responderEnOrden("from:curso_calificaciones", [{ data: { id: "cal-mia" } }, { error: null }]);

    expect(await calificarCurso("curso-1", 2, "Cambié de opinión")).toEqual({ success: true });

    const [, escritura] = servidorFalso.llamadasA("from:curso_calificaciones");
    expect(escritura.cadena).toEqual([
      { metodo: "update", argumentos: [{ puntuacion: 2, comentario: "Cambié de opinión" }] },
      { metodo: "eq", argumentos: ["id", "cal-mia"] },
    ]);
    expect(servidorFalso.encadenado("from:curso_calificaciones", "insert")).toEqual([]);
  });

  it("un comentario vacío o de solo espacios se guarda como null", async () => {
    await calificarCurso("curso-1", 5, "   ");

    expect(servidorFalso.encadenado("from:curso_calificaciones", "insert")[0][0]).toMatchObject({ comentario: null });
  });

  it.each([
    [0, "La calificación mínima es 1 estrella."],
    [6, "La calificación máxima es 5 estrellas."],
    [3.5, "La calificación debe ser un número entero."],
  ])("puntuación %s se rechaza antes de leer la base", async (puntuacion, mensaje) => {
    expect(await calificarCurso("curso-1", puntuacion, "")).toEqual({ error: mensaje });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
  });

  it("un comentario de más de 1000 caracteres se rechaza sin escribir", async () => {
    expect(await calificarCurso("curso-1", 5, "a".repeat(1001))).toEqual({ error: "El comentario es demasiado largo." });
    expect(escrituras()).toEqual([]);
  });

  it("si la base rechaza (sin acceso vigente), ni confirma ni revalida", async () => {
    servidorFalso.responderEnOrden("from:curso_calificaciones", [{ data: null }, { error: { message: "RLS" } }]);

    expect(await calificarCurso("curso-1", 5, "")).toEqual({
      error: "No pudimos guardar tu calificación. Verifica que tengas acceso vigente al curso.",
    });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });
});

describe("eliminarCalificacionPropia", () => {
  it("borrado lógico filtrado por el autor de la sesión", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: [{ id: "cal-mia" }] });

    expect(await eliminarCalificacionPropia("cal-mia")).toEqual({ success: true });
    expect(servidorFalso.llamadasA("from:curso_calificaciones")[0].cadena).toEqual([
      { metodo: "update", argumentos: [{ eliminado: true }] },
      { metodo: "eq", argumentos: ["id", "cal-mia"] },
      { metodo: "eq", argumentos: ["id_usuario", ESTUDIANTE.id] },
      { metodo: "select", argumentos: ["id"] },
    ]);
  });

  it("si no cambió ninguna fila (reseña ajena o inexistente) NO responde éxito", async () => {
    // Hallazgo P2-9: PostgREST no da error por un UPDATE sin coincidencias, y
    // la pantalla mostraba la reseña como eliminada sin que lo estuviera.
    servidorFalso.responder("from:curso_calificaciones", { data: [] });

    expect(await eliminarCalificacionPropia("cal-de-otro")).toEqual({
      error: "No encontramos tu calificación. Recarga la página.",
    });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("error de la base: mensaje y sin revalidar", async () => {
    servidorFalso.responder("from:curso_calificaciones", { error: { message: "caída" } });

    expect(await eliminarCalificacionPropia("cal-mia")).toEqual({ error: "No pudimos eliminar tu calificación." });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });
});

describe("moderarCalificacion", () => {
  beforeEach(() => {
    servidorFalso.conUsuario(ADMIN);
    servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" } });
    servidorFalso.responder("from:curso_calificaciones", { data: [{ id: "cal-1" }] });
  });

  it("un estudiante no modera: ni escritura ni bitácora", async () => {
    servidorFalso.conUsuario(ESTUDIANTE);
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" } });

    expect(await moderarCalificacion("cal-1")).toEqual({ error: "No tienes permiso para moderar reseñas." });
    expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([["id", ESTUDIANTE.id]]);
    expect(escrituras()).toEqual([]);
    expect(registrarBitacora).not.toHaveBeenCalled();
  });

  it("sin perfil legible tampoco (no se asume admin por defecto)", async () => {
    servidorFalso.responder("from:perfiles", { data: null });

    expect(await moderarCalificacion("cal-1")).toEqual({ error: "No tienes permiso para moderar reseñas." });
    expect(escrituras()).toEqual([]);
  });

  it("un admin oculta la reseña firmando con SU id y deja bitácora", async () => {
    expect(await moderarCalificacion("cal-1")).toEqual({ success: true });

    expect(servidorFalso.encadenado("from:curso_calificaciones", "update")).toEqual([
      [{ eliminado: true, eliminado_por_admin: true, id_eliminado_por: ADMIN.id }],
    ]);
    expect(servidorFalso.encadenado("from:curso_calificaciones", "eq")).toEqual([["id", "cal-1"]]);
    expect(registrarBitacora).toHaveBeenCalledWith(expect.anything(), {
      idAdmin: ADMIN.id,
      accion: "Eliminó una reseña de curso (moderación)",
      entidadAfectada: "curso_calificaciones",
      idEntidadAfectada: "cal-1",
    });
  });

  it("si no cambió ninguna fila, no responde éxito ni deja bitácora de algo que no pasó", async () => {
    servidorFalso.responder("from:curso_calificaciones", { data: [] });

    expect(await moderarCalificacion("no-existe")).toEqual({ error: "Esa reseña ya no existe." });
    expect(registrarBitacora).not.toHaveBeenCalled();
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("si la base rechaza, tampoco hay bitácora", async () => {
    servidorFalso.responder("from:curso_calificaciones", { error: { message: "check_violation" } });

    expect(await moderarCalificacion("cal-1")).toEqual({ error: "No pudimos eliminar la reseña." });
    expect(registrarBitacora).not.toHaveBeenCalled();
  });
});

describe("reacciones", () => {
  it("reaccionar: upsert idempotente con el usuario de la sesión", async () => {
    expect(await reaccionarCalificacion("cal-1")).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:curso_calificacion_reacciones", "upsert")).toEqual([
      [
        { id_calificacion: "cal-1", id_usuario: ESTUDIANTE.id },
        { onConflict: "id_calificacion,id_usuario", ignoreDuplicates: true },
      ],
    ]);
  });

  it("quitar: borra solo la reacción propia", async () => {
    expect(await quitarReaccionCalificacion("cal-1")).toEqual({ success: true });
    expect(servidorFalso.llamadasA("from:curso_calificacion_reacciones")[0].cadena).toEqual([
      { metodo: "delete", argumentos: [] },
      { metodo: "eq", argumentos: ["id_calificacion", "cal-1"] },
      { metodo: "eq", argumentos: ["id_usuario", ESTUDIANTE.id] },
    ]);
  });

  it.each([
    ["reaccionar", () => reaccionarCalificacion("cal-1"), "No pudimos guardar tu reacción."],
    ["quitar", () => quitarReaccionCalificacion("cal-1"), "No pudimos quitar tu reacción."],
  ])("%s con error de la base no revalida", async (_nombre, accion, mensaje) => {
    servidorFalso.responder("from:curso_calificacion_reacciones", { error: { message: "RLS" } });

    expect(await accion()).toEqual({ error: mensaje });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });
});

describe("revalidación", () => {
  it("todas las acciones exitosas revalidan la ficha de curso y nada más", async () => {
    // Hallazgo P2-9: la ruta llegaba como argumento desde el navegador y se
    // pasaba tal cual a revalidatePath. Ahora ninguna acción la acepta.
    servidorFalso.conUsuario(ADMIN);
    servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" } });
    servidorFalso.responder("from:curso_calificaciones", { data: [{ id: "cal-1" }] });

    await eliminarCalificacionPropia("cal-1");
    await moderarCalificacion("cal-1");
    await reaccionarCalificacion("cal-1");
    await quitarReaccionCalificacion("cal-1");
    servidorFalso.responder("from:curso_calificaciones", { data: null });
    await calificarCurso("curso-1", 5, "");

    expect(vi.mocked(revalidatePath).mock.calls).toEqual(Array(5).fill(["/cursos/[cursoSlug]", "page"]));
  });

  it("ninguna acción acepta una ruta del cliente", () => {
    // `Function.length` cuenta los parámetros declarados: si alguien vuelve
    // a agregar `ruta`, esto lo nota antes que una revisión.
    expect(calificarCurso.length).toBe(3);
    expect(eliminarCalificacionPropia.length).toBe(1);
    expect(moderarCalificacion.length).toBe(1);
    expect(reaccionarCalificacion.length).toBe(1);
    expect(quitarReaccionCalificacion.length).toBe(1);
  });
});
