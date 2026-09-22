import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso, type LlamadaRegistrada } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));
// Mux propio (no el `sdkFalso` genérico): hace falta controlar qué devuelve
// `uploads.create` y hacer fallar `assets.delete`.
vi.mock("@/lib/mux/client", () => ({
  mux: { video: { uploads: { create: vi.fn() }, assets: { delete: vi.fn() } } },
}));

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { mux } from "@/lib/mux/client";
import { iniciarSubidaVideoLeccion, quitarVideoLeccion } from "@/actions/admin/mux";
import { eliminarLeccion, eliminarModulo } from "@/actions/admin/cursos";

/**
 * P2-7 (AUDIT-2026-09-22.md): videos de Mux que quedaban huérfanos o
 * lecciones que apuntaban a videos borrados.
 *
 * Lo que importa en todas es el ORDEN: el asset se encola antes de soltar la
 * lección, solo se borra en Mux cuando ninguna lección lo usa, y si el paso
 * intermedio falla se saca de la cola (mux:limpiar borraría un video vivo).
 */

const LECCION = "11111111-1111-4111-8111-111111111111";
const CURSO = "22222222-2222-4222-8222-222222222222";
const MODULO = "33333333-3333-4333-8333-333333333333";

const borrarEnMux = vi.mocked(mux.video.assets.delete);

/** Respuestas de la cola según la operación encadenada. */
function colaResponde({ insert = {} as { data?: unknown; error?: unknown } } = {}) {
  servidorFalso.responderSegun("from:mux_assets_pendientes_eliminacion", (llamada) => {
    const metodos = llamada.cadena.map((c) => c.metodo);
    if (metodos.includes("insert")) {
      const filas = (llamada.cadena.find((c) => c.metodo === "insert")!.argumentos[0] as unknown[]).length;
      return "error" in insert || "data" in insert
        ? insert
        : { data: Array.from({ length: filas }, (_, i) => ({ id: `cola-${i + 1}` })) };
    }
    return { data: null, error: null };
  });
}

function metodosDe(llamada: LlamadaRegistrada): string[] {
  return llamada.cadena.map((c) => c.metodo);
}

/** Índice de la primera llamada que cumple, para afirmar el orden. */
function indice(pred: (l: LlamadaRegistrada) => boolean): number {
  return servidorFalso.llamadas.findIndex(pred);
}

const esEncolado = (l: LlamadaRegistrada) =>
  l.operacion === "from:mux_assets_pendientes_eliminacion" && metodosDe(l).includes("insert");
const esDesencolado = (l: LlamadaRegistrada) =>
  l.operacion === "from:mux_assets_pendientes_eliminacion" && metodosDe(l).includes("delete");
const esMarcadoEliminado = (l: LlamadaRegistrada) =>
  l.operacion === "from:mux_assets_pendientes_eliminacion" && metodosDe(l).includes("update");

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockResolvedValue({ supabase: crearCliente("sesion") as never, adminId: "admin-1" });
  borrarEnMux.mockReset().mockResolvedValue(undefined as never);
  vi.mocked(mux.video.uploads.create).mockReset();
  servidorFalso.responder("from:cursos", { data: { titulo: "Taller" } });
});

describe("quitarVideoLeccion", () => {
  function leccionCon(campos: { id_mux_asset_id: string | null; id_mux_upload_id: string | null }) {
    servidorFalso.responderSegun("from:lecciones", (llamada) =>
      metodosDe(llamada).includes("update")
        ? { error: null }
        : { data: { id: LECCION, titulo: "Clase 1", ...campos } },
    );
  }

  it("encola el asset, deja la lección sin video y recién después lo borra en Mux", async () => {
    leccionCon({ id_mux_asset_id: "asset-1", id_mux_upload_id: "upload-1" });
    colaResponde();

    expect(await quitarVideoLeccion(LECCION, CURSO)).toEqual({ success: true });

    const updateLeccion = servidorFalso.llamadas.find(
      (l) => l.operacion === "from:lecciones" && metodosDe(l).includes("update"),
    )!;
    expect(updateLeccion.cadena.find((c) => c.metodo === "update")!.argumentos[0]).toEqual({
      id_video_mux: null,
      id_mux_asset_id: null,
      id_mux_upload_id: null,
      duracion: null,
      estado_procesamiento: "SUBIENDO",
      error_procesamiento: null,
    });
    expect(indice(esEncolado)).toBeLessThan(servidorFalso.llamadas.indexOf(updateLeccion));
    expect(borrarEnMux).toHaveBeenCalledWith("asset-1");
    expect(indice(esMarcadoEliminado)).toBeGreaterThan(servidorFalso.llamadas.indexOf(updateLeccion));

    // Como un reemplazo: reanudación a 0 (conserva "completada") y fuera la
    // transcripción del video que ya no existe.
    expect(servidorFalso.encadenado("from:progreso", "update")).toEqual([[{ segundo_actual: 0 }]]);
    expect(servidorFalso.llamadasA("from:transcripciones_video")[0].cadena.map((c) => c.metodo)).toContain("delete");
  });

  it("si no puede quitarle el video a la lección, saca el asset de la cola y NO lo borra en Mux", async () => {
    servidorFalso.responderSegun("from:lecciones", (llamada) =>
      metodosDe(llamada).includes("update")
        ? { error: { message: "rls" } }
        : { data: { id: LECCION, titulo: "Clase 1", id_mux_asset_id: "asset-1", id_mux_upload_id: null } },
    );
    colaResponde();

    expect(await quitarVideoLeccion(LECCION, CURSO)).toEqual({ error: "No pudimos quitar el video de la lección." });
    expect(indice(esDesencolado)).toBeGreaterThan(-1);
    expect(borrarEnMux).not.toHaveBeenCalled();
  });

  it("si no puede encolar, no toca la lección", async () => {
    leccionCon({ id_mux_asset_id: "asset-1", id_mux_upload_id: null });
    colaResponde({ insert: { error: { message: "caída" } } });

    expect((await quitarVideoLeccion(LECCION, CURSO)).error).toMatch(/preparar el borrado/);
    expect(servidorFalso.encadenado("from:lecciones", "update")).toEqual([]);
    expect(borrarEnMux).not.toHaveBeenCalled();
  });

  it("con Mux caído la lección igual queda sin video: el asset sigue en cola para mux:limpiar", async () => {
    leccionCon({ id_mux_asset_id: "asset-1", id_mux_upload_id: null });
    colaResponde();
    borrarEnMux.mockRejectedValue(new Error("fetch failed"));

    expect(await quitarVideoLeccion(LECCION, CURSO)).toEqual({ success: true });
    expect(indice(esMarcadoEliminado)).toBe(-1);
    expect(indice(esDesencolado)).toBe(-1);
  });

  it("una subida en curso sin asset todavía: no hay nada que encolar, solo se suelta el upload", async () => {
    leccionCon({ id_mux_asset_id: null, id_mux_upload_id: "upload-1" });
    colaResponde();

    expect(await quitarVideoLeccion(LECCION, CURSO)).toEqual({ success: true });
    expect(indice(esEncolado)).toBe(-1);
    expect(servidorFalso.encadenado("from:lecciones", "update")[0][0]).toMatchObject({ id_mux_upload_id: null });
    expect(borrarEnMux).not.toHaveBeenCalled();
  });

  it("una lección sin video no se toca", async () => {
    leccionCon({ id_mux_asset_id: null, id_mux_upload_id: null });

    expect(await quitarVideoLeccion(LECCION, CURSO)).toEqual({ error: "Esta lección no tiene video." });
    expect(servidorFalso.encadenado("from:lecciones", "update")).toEqual([]);
  });
});

describe("iniciarSubidaVideoLeccion", () => {
  it("un reemplazo NO borra `id_mux_asset_id`: el webhook lo necesita para borrar el video viejo", async () => {
    // Antes se ponía en null al iniciar la subida, así que la limpieza del
    // reemplazo en video.asset.ready nunca encontraba el asset anterior.
    servidorFalso.responder("from:lecciones", {
      data: { id: LECCION, titulo: "Clase 1", id_mux_asset_id: "asset-viejo" },
    });
    vi.mocked(mux.video.uploads.create).mockResolvedValue({ id: "upload-2", url: "https://mux/subir" } as never);

    expect(await iniciarSubidaVideoLeccion(LECCION, CURSO)).toMatchObject({ success: true });
    const cambios = servidorFalso.encadenado("from:lecciones", "update")[0][0] as Record<string, unknown>;
    expect(cambios).toMatchObject({ id_mux_upload_id: "upload-2", estado_procesamiento: "SUBIENDO" });
    expect(cambios).not.toHaveProperty("id_mux_asset_id");
  });
});

describe("eliminarLeccion", () => {
  it("encola su video, borra la lección y después lo borra en Mux", async () => {
    servidorFalso.responderSegun("from:lecciones", (llamada) =>
      metodosDe(llamada).includes("delete") ? { error: null } : { data: { titulo: "Clase 1", id_mux_asset_id: "asset-1" } },
    );
    colaResponde();

    expect(await eliminarLeccion(LECCION, CURSO)).toEqual({ success: true });

    const borradoLeccion = indice((l) => l.operacion === "from:lecciones" && metodosDe(l).includes("delete"));
    expect(indice(esEncolado)).toBeLessThan(borradoLeccion);
    expect(borrarEnMux).toHaveBeenCalledWith("asset-1");
    expect(indice(esMarcadoEliminado)).toBeGreaterThan(borradoLeccion);
  });

  it("si el DELETE falla, el video sigue en uso: se saca de la cola y no se borra en Mux", async () => {
    servidorFalso.responderSegun("from:lecciones", (llamada) =>
      metodosDe(llamada).includes("delete")
        ? { error: { message: "fk" } }
        : { data: { titulo: "Clase 1", id_mux_asset_id: "asset-1" } },
    );
    colaResponde();

    expect(await eliminarLeccion(LECCION, CURSO)).toEqual({ error: "No pudimos eliminar la lección." });
    expect(indice(esDesencolado)).toBeGreaterThan(-1);
    expect(borrarEnMux).not.toHaveBeenCalled();
  });

  it("una lección sin video se borra sin tocar la cola ni Mux", async () => {
    servidorFalso.responderSegun("from:lecciones", (llamada) =>
      metodosDe(llamada).includes("delete") ? { error: null } : { data: { titulo: "Clase 1", id_mux_asset_id: null } },
    );

    expect(await eliminarLeccion(LECCION, CURSO)).toEqual({ success: true });
    expect(servidorFalso.llamadasA("from:mux_assets_pendientes_eliminacion")).toEqual([]);
    expect(borrarEnMux).not.toHaveBeenCalled();
  });
});

describe("eliminarModulo", () => {
  it("encola los videos de todas sus lecciones y los borra en Mux tras borrar el módulo", async () => {
    servidorFalso.responder("from:lecciones", {
      data: [
        { id: "l1", id_mux_asset_id: "asset-1" },
        { id: "l2", id_mux_asset_id: null },
        { id: "l3", id_mux_asset_id: "asset-3" },
      ],
    });
    servidorFalso.responder("from:modulos", { error: null });
    colaResponde();

    expect(await eliminarModulo(MODULO)).toEqual({ success: true });

    const encolado = servidorFalso.llamadas.find(esEncolado)!;
    expect(encolado.cadena.find((c) => c.metodo === "insert")!.argumentos[0]).toEqual([
      { id_leccion: "l1", id_asset_mux: "asset-1" },
      { id_leccion: "l3", id_asset_mux: "asset-3" },
    ]);
    expect(indice(esEncolado)).toBeLessThan(indice((l) => l.operacion === "from:modulos"));
    expect(borrarEnMux.mock.calls.map(([id]) => id).sort()).toEqual(["asset-1", "asset-3"]);
  });

  it("si el módulo no se puede borrar, sus videos salen de la cola y siguen en Mux", async () => {
    servidorFalso.responder("from:lecciones", { data: [{ id: "l1", id_mux_asset_id: "asset-1" }] });
    servidorFalso.responder("from:modulos", { error: { message: "fk" } });
    colaResponde();

    expect(await eliminarModulo(MODULO)).toEqual({ error: "No pudimos eliminar el módulo." });
    expect(indice(esDesencolado)).toBeGreaterThan(-1);
    expect(borrarEnMux).not.toHaveBeenCalled();
  });
});
