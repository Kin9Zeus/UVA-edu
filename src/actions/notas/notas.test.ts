import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { crearNota } from "@/actions/notas/crear";
import { editarNota } from "@/actions/notas/editar";
import { eliminarNota } from "@/actions/notas/eliminar";
import { listarNotasDelCurso } from "@/actions/notas/listar";
import { logError } from "@/lib/log";

/**
 * Notas privadas por clase — P2-6 (AUDIT-2026-09-22.md). La autorización la
 * hace RLS (supabase/sql/115, probada en test:rls); esta capa tiene que
 * (1) tomar el autor de la sesión y nunca del cliente, (2) validar la forma
 * antes de tocar la base y (3) traducir los rechazos de la base a mensajes
 * legibles sin filtrar el contenido de la nota a los logs.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const LECCION = "11111111-1111-4111-8111-111111111111";
const NOTA = "22222222-2222-4222-8222-222222222222";

const FILA = {
  id: NOTA,
  id_leccion: LECCION,
  segundo: 95,
  contenido: "Revisar el ajuste de exposición",
  id_video_mux: "pb-1",
  actualizado_en: "2026-09-22T10:00:00Z",
};

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  vi.mocked(logError).mockClear();
});

describe("crearNota", () => {
  it("guarda con el autor de la SESIÓN y devuelve la nota lista para pintar", async () => {
    servidorFalso.responder("from:notas_leccion", { data: FILA });

    const resultado = await crearNota(LECCION, 95, "  Revisar el ajuste de exposición  ");

    expect(resultado).toEqual({
      success: true,
      nota: {
        id: NOTA,
        leccionId: LECCION,
        segundo: 95,
        contenido: FILA.contenido,
        videoCambio: false,
        actualizadoEn: FILA.actualizado_en,
      },
    });
    expect(servidorFalso.encadenado("from:notas_leccion", "insert")[0][0]).toEqual({
      id_usuario: ESTUDIANTE.id,
      id_leccion: LECCION,
      segundo: 95,
      contenido: "Revisar el ajuste de exposición",
    });
  });

  it("sin sesión no toca la base", async () => {
    servidorFalso.conUsuario(null);

    expect(await crearNota(LECCION, 10, "hola")).toEqual({ error: "Debes iniciar sesión para guardar notas." });
    expect(servidorFalso.llamadasA("from:notas_leccion")).toHaveLength(0);
  });

  it.each([
    ["clase que no es uuid", "no-es-uuid", 10, "hola", "Clase inválida."],
    ["segundo negativo", LECCION, -1, "hola", "El minuto de la nota no es válido."],
    ["segundo con decimales", LECCION, 1.5, "hola", "El minuto de la nota no es válido."],
    ["nota vacía (solo espacios)", LECCION, 10, "   ", "Escribe algo antes de guardar la nota."],
    ["nota de más de 2000 caracteres", LECCION, 10, "a".repeat(2001), "La nota es demasiado larga."],
  ])("%s: se rechaza sin tocar la base", async (_caso, leccion, segundo, texto, mensaje) => {
    expect(await crearNota(leccion, segundo, texto)).toEqual({ error: mensaje });
    expect(servidorFalso.llamadasA("from:notas_leccion")).toHaveLength(0);
  });

  it("P0N01 del trigger (tope por clase) se traduce al límite de 200 notas", async () => {
    servidorFalso.responder("from:notas_leccion", { data: null, error: { code: "P0N01", message: "tope" } });

    expect(await crearNota(LECCION, 10, "hola")).toEqual({ error: "Llegaste al máximo de 200 notas en esta clase." });
    expect(logError).not.toHaveBeenCalled();
  });

  it("42501 de la policy (sin acceso, suspendido, sin verificar) no se registra como fallo del sistema", async () => {
    servidorFalso.responder("from:notas_leccion", { data: null, error: { code: "42501", message: "rls" } });

    expect(await crearNota(LECCION, 10, "hola")).toEqual({ error: "No tienes acceso para guardar notas en esta clase." });
    expect(logError).not.toHaveBeenCalled();
  });

  it("un fallo real se registra SIN el contenido de la nota (dato personal)", async () => {
    servidorFalso.responder("from:notas_leccion", { data: null, error: { code: "57014", message: "timeout" } });

    expect(await crearNota(LECCION, 10, "mi dato privado")).toEqual({
      error: "No pudimos guardar tu nota. Intenta de nuevo.",
    });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(logError).mock.calls[0])).not.toContain("mi dato privado");
  });
});

describe("editarNota", () => {
  it("cambia solo el texto (y el segundo si viene), filtrando por la nota pedida", async () => {
    servidorFalso.responder("from:notas_leccion", { data: [{ actualizado_en: "2026-09-22T11:00:00Z" }] });

    expect(await editarNota(NOTA, " nuevo texto ", 30)).toEqual({
      success: true,
      actualizadoEn: "2026-09-22T11:00:00Z",
    });
    expect(servidorFalso.encadenado("from:notas_leccion", "update")[0][0]).toEqual({
      contenido: "nuevo texto",
      segundo: 30,
    });
    expect(servidorFalso.encadenado("from:notas_leccion", "eq")).toEqual([["id", NOTA]]);
  });

  it("sin segundo no lo toca", async () => {
    servidorFalso.responder("from:notas_leccion", { data: [{ actualizado_en: "x" }] });

    await editarNota(NOTA, "texto");

    expect(servidorFalso.encadenado("from:notas_leccion", "update")[0][0]).toEqual({ contenido: "texto" });
  });

  it("una nota ajena o inexistente (RLS la oculta: 0 filas) responde que ya no existe", async () => {
    servidorFalso.responder("from:notas_leccion", { data: [] });

    expect(await editarNota(NOTA, "texto")).toEqual({ error: "La nota ya no existe." });
  });

  it("entradas inválidas no llegan a la base", async () => {
    expect(await editarNota("no-es-uuid", "texto")).toEqual({ error: "Nota inválida." });
    expect(await editarNota(NOTA, "")).toEqual({ error: "Escribe algo antes de guardar la nota." });
    expect(await editarNota(NOTA, "texto", 86_401)).toEqual({ error: "El minuto de la nota no es válido." });
    expect(servidorFalso.llamadasA("from:notas_leccion")).toHaveLength(0);
  });

  it("sin sesión no toca la base", async () => {
    servidorFalso.conUsuario(null);

    expect(await editarNota(NOTA, "texto")).toEqual({ error: "Debes iniciar sesión." });
    expect(servidorFalso.llamadasA("from:notas_leccion")).toHaveLength(0);
  });
});

describe("eliminarNota", () => {
  it("borra por id y es idempotente (una nota ya borrada también es éxito)", async () => {
    expect(await eliminarNota(NOTA)).toEqual({ success: true });
    const [borrado] = servidorFalso.llamadasA("from:notas_leccion");
    expect(borrado.cadena.map((c) => c.metodo)).toEqual(["delete", "eq"]);
    expect(borrado.cliente).toBe("sesion");
  });

  it("un fallo de la base se informa y se registra", async () => {
    servidorFalso.responder("from:notas_leccion", { error: { message: "timeout" } });

    expect(await eliminarNota(NOTA)).toEqual({ error: "No pudimos eliminar la nota. Intenta de nuevo." });
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("id inválido o sin sesión: no toca la base", async () => {
    expect(await eliminarNota("x")).toEqual({ error: "Nota inválida." });
    servidorFalso.conUsuario(null);
    expect(await eliminarNota(NOTA)).toEqual({ error: "Debes iniciar sesión." });
    expect(servidorFalso.llamadasA("from:notas_leccion")).toHaveLength(0);
  });
});

describe("listarNotasDelCurso", () => {
  it("lee solo las notas del usuario de la sesión en esas clases", async () => {
    servidorFalso.responder("from:notas_leccion", { data: [] });

    expect(await listarNotasDelCurso([LECCION])).toEqual({ success: true, notas: [] });
    expect(servidorFalso.encadenado("from:notas_leccion", "eq")).toContainEqual(["id_usuario", ESTUDIANTE.id]);
    expect(servidorFalso.encadenado("from:notas_leccion", "in")).toEqual([["id_leccion", [LECCION]]]);
  });

  it.each([
    ["lista vacía", []],
    ["un id que no es uuid", ["x"]],
    ["más de 500 clases", Array.from({ length: 501 }, () => LECCION)],
  ])("%s: se rechaza sin consultar", async (_caso, ids) => {
    expect(await listarNotasDelCurso(ids)).toEqual({ error: "Curso inválido." });
    expect(servidorFalso.llamadasA("from:notas_leccion")).toHaveLength(0);
  });
});
