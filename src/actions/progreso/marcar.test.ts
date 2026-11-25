import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { logError } from "@/lib/log";
import { reiniciarUnaVezPorMinuto } from "@/lib/una-vez-por-minuto";
import { guardarSegundoActual, iniciarProgresoLeccion, marcarLeccion } from "@/actions/progreso/marcar";

/**
 * Progreso — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * El progreso es lo que abre el examen y, con él, el certificado. Las tres
 * acciones hacen UPSERT, y un upsert con `id_usuario` equivocado no falla:
 * escribe en la fila de otro. Por eso lo que se afirma es que el id sale
 * siempre de la sesión, y que cada upsert conserva su `onConflict`.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };

function upserts(): unknown[][] {
  return servidorFalso.encadenado("from:progreso", "upsert");
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  reiniciarUnaVezPorMinuto();
  vi.mocked(logError).mockClear();
});

describe("sin sesión ninguna escribe", () => {
  beforeEach(() => servidorFalso.conUsuario(null));

  it("marcarLeccion", async () => {
    expect(await marcarLeccion("leccion-1", true)).toEqual({ error: "Tu sesión expiró. Vuelve a iniciar sesión." });
    expect(upserts()).toEqual([]);
  });

  it("iniciarProgresoLeccion", async () => {
    await iniciarProgresoLeccion("leccion-1");
    expect(upserts()).toEqual([]);
  });

  it("guardarSegundoActual", async () => {
    expect(await guardarSegundoActual("leccion-1", 30)).toEqual({ success: false });
    expect(upserts()).toEqual([]);
  });
});

describe("marcarLeccion", () => {
  it.each([true, false])("completado=%s con el id de la sesión", async (completado) => {
    expect(await marcarLeccion("leccion-1", completado)).toEqual({ success: true, completado });
    expect(upserts()).toEqual([
      [{ id_usuario: ESTUDIANTE.id, id_leccion: "leccion-1", completado }, { onConflict: "id_usuario,id_leccion" }],
    ]);
    expect(servidorFalso.revalidaciones).toEqual(["/dashboard"]);
  });

  it("si la base rechaza, no revalida ni confirma", async () => {
    servidorFalso.responder("from:progreso", { error: { message: "RLS" } });

    expect(await marcarLeccion("leccion-1", true)).toEqual({ error: "No pudimos guardar tu progreso. Intenta de nuevo." });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });
});

describe("iniciarProgresoLeccion", () => {
  it("crea la fila si no existe y NUNCA pisa una ya completada", async () => {
    // Sin `ignoreDuplicates`, volver a abrir una clase terminada la
    // reiniciaría a completado=false (el default de la columna).
    await iniciarProgresoLeccion("leccion-1");

    expect(upserts()).toEqual([
      [
        { id_usuario: ESTUDIANTE.id, id_leccion: "leccion-1" },
        { onConflict: "id_usuario,id_leccion", ignoreDuplicates: true },
      ],
    ]);
  });
});

describe("guardarSegundoActual", () => {
  it.each([
    [125.9, 125],
    [-40, 0],
    [0, 0],
  ])("%s s → guarda %s", async (entrada, guardado) => {
    expect(await guardarSegundoActual("leccion-1", entrada)).toEqual({ success: true });
    expect(upserts()[0][0]).toEqual({ id_usuario: ESTUDIANTE.id, id_leccion: "leccion-1", segundo_actual: guardado });
  });

  it("no toca `completado`: guardar la posición del video no marca ni desmarca la clase", async () => {
    await guardarSegundoActual("leccion-1", 10);

    expect(upserts()[0][0]).not.toHaveProperty("completado");
  });

  it("si la base rechaza el guardado, responde false y queda UN aviso por minuto (P3-1)", async () => {
    servidorFalso.responder("from:progreso", { data: null, error: { message: "timeout", code: "57014" } });

    for (let i = 0; i < 10; i++) expect(await guardarSegundoActual("leccion-1", 30)).toEqual({ success: false });

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      "guardarSegundoActual",
      expect.any(String),
      expect.objectContaining({ code: "57014" }),
      expect.objectContaining({ leccionId: "leccion-1", nivel: "warning" }),
    );
  });

  it("si guarda, no registra nada", async () => {
    await guardarSegundoActual("leccion-1", 30);
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("%s no se escribe", async (entrada) => {
    expect(await guardarSegundoActual("leccion-1", entrada)).toEqual({ success: false });
    expect(upserts()).toEqual([]);
  });
});
