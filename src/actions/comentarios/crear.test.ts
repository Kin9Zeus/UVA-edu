import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));

import { crearComentario } from "@/actions/comentarios/crear";
import { logError } from "@/lib/log";

/**
 * La autorización la hace RLS (`comentarios_insert_propio`, 125, probada en
 * test:rls). Esta capa traduce el rechazo de la policy a "sin acceso" y no
 * lo confunde con un fallo del sistema, que sí se registra.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const LECCION = "11111111-1111-4111-8111-111111111111";
const RUTA = "/cursos/revit/que-es-bim";

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  vi.mocked(logError).mockClear();
});

describe("crearComentario", () => {
  it("publica con el autor de la SESIÓN", async () => {
    servidorFalso.responder("from:comentarios", { data: { id: "c-1" } });

    expect(await crearComentario(LECCION, "  Muy clara la clase  ", null, RUTA)).toEqual({ success: true, id: "c-1" });
    expect(servidorFalso.encadenado("from:comentarios", "insert")[0][0]).toEqual({
      id_leccion: LECCION,
      id_usuario: ESTUDIANTE.id,
      id_comentario_padre: null,
      contenido: "Muy clara la clase",
    });
  });

  it("42501 de la policy se dice como falta de acceso y no se registra como fallo", async () => {
    servidorFalso.responder("from:comentarios", { data: null, error: { code: "42501", message: "rls" } });

    expect(await crearComentario(LECCION, "hola", null, RUTA)).toEqual({
      error: "No tienes acceso para comentar en esta clase.",
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it("un fallo real se registra SIN el texto del comentario", async () => {
    servidorFalso.responder("from:comentarios", { data: null, error: { code: "57014", message: "timeout" } });

    expect(await crearComentario(LECCION, "mi texto privado", null, RUTA)).toEqual({
      error: "No pudimos publicar tu comentario. Intenta de nuevo.",
    });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(logError).mock.calls[0])).not.toContain("mi texto privado");
  });
});
