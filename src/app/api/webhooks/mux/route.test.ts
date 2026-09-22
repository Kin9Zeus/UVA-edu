import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso, type LlamadaRegistrada } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/webhooks/eventos", () => ({
  registrarEvento: vi.fn(async () => ({ estado: "nuevo" })),
  marcarProcesado: vi.fn(),
}));
vi.mock("@/lib/mux/client", () => ({ mux: { video: { assets: { delete: vi.fn() } } } }));
// La firma se prueba en scripts/webhook-test.ts; acá `unwrap` solo parsea.
vi.mock("@mux/mux-node", async (original) => {
  const real = await original<typeof import("@mux/mux-node")>();
  class MuxFalso {
    webhooks = { unwrap: async (cuerpo: string) => JSON.parse(cuerpo) };
  }
  return { ...real, default: MuxFalso };
});

import { NextRequest } from "next/server";
import { mux } from "@/lib/mux/client";
import { POST } from "@/app/api/webhooks/mux/route";

/**
 * Webhook de Mux — P2-7 (AUDIT-2026-09-22.md): borrados hechos fuera de la
 * app y assets que nadie va a usar.
 */

const borrarEnMux = vi.mocked(mux.video.assets.delete);

function evento(type: string, data: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/webhooks/mux", {
      method: "POST",
      body: JSON.stringify({ id: `evt-${type}`, type, data }),
    }),
  );
}

const metodos = (l: LlamadaRegistrada) => l.cadena.map((c) => c.metodo);

beforeEach(() => {
  servidorFalso.reiniciar();
  process.env.MUX_WEBHOOK_SECRET = "secreto";
  borrarEnMux.mockReset().mockResolvedValue(undefined as never);
});

describe("video.asset.deleted (borrado desde el panel de Mux)", () => {
  it("deja en ERROR la lección que apuntaba a ese asset, sin video", async () => {
    const respuesta = await evento("video.asset.deleted", { id: "asset-1" });

    expect(respuesta.status).toBe(200);
    const [update] = servidorFalso.llamadasA("from:lecciones");
    expect(update.cadena).toContainEqual({ metodo: "eq", argumentos: ["id_mux_asset_id", "asset-1"] });
    expect(update.cadena.find((c) => c.metodo === "update")!.argumentos[0]).toMatchObject({
      id_video_mux: null,
      id_mux_asset_id: null,
      estado_procesamiento: "ERROR",
      error_procesamiento: "El video se borró en Mux. Sube uno nuevo.",
    });
    // Nada que volver a borrar.
    expect(borrarEnMux).not.toHaveBeenCalled();
  });

  it("si no puede marcar la lección responde 500 para que Mux reintente", async () => {
    servidorFalso.responder("from:lecciones", { error: { message: "caída" } });

    expect((await evento("video.asset.deleted", { id: "asset-1" })).status).toBe(500);
  });
});

describe("video.asset.ready sin lección que lo espere", () => {
  it("un asset huérfano (upload superado o lección borrada) se encola y se borra de Mux", async () => {
    servidorFalso.responderSegun("from:lecciones", () => ({ data: null }));
    servidorFalso.responderSegun("from:mux_assets_pendientes_eliminacion", (l) =>
      metodos(l).includes("insert") ? { data: [{ id: "cola-1" }] } : { data: null },
    );

    const respuesta = await evento("video.asset.ready", {
      id: "asset-huerfano",
      upload_id: "upload-viejo",
      playback_ids: [{ id: "pb-1", policy: "signed" }],
    });

    expect(respuesta.status).toBe(200);
    expect(servidorFalso.encadenado("from:mux_assets_pendientes_eliminacion", "insert")[0][0]).toEqual([
      { id_leccion: null, id_asset_mux: "asset-huerfano" },
    ]);
    expect(borrarEnMux).toHaveBeenCalledWith("asset-huerfano");
    // Y no se intentó escribir ninguna lección.
    expect(servidorFalso.llamadasA("from:lecciones").some((l) => metodos(l).includes("update"))).toBe(false);
  });

  it("con lección esperándolo, sigue el camino normal: LISTO y sin borrar nada", async () => {
    servidorFalso.responderSegun("from:lecciones", (l) =>
      metodos(l).includes("update") ? { error: null } : { data: { id: "leccion-1", id_mux_asset_id: null } },
    );

    const respuesta = await evento("video.asset.ready", {
      id: "asset-nuevo",
      upload_id: "upload-1",
      duration: 61.4,
      playback_ids: [{ id: "pb-1", policy: "signed" }],
    });

    expect(respuesta.status).toBe(200);
    expect(servidorFalso.encadenado("from:lecciones", "update")[0][0]).toMatchObject({
      id_mux_asset_id: "asset-nuevo",
      estado_procesamiento: "LISTO",
      duracion: 61,
    });
    expect(borrarEnMux).not.toHaveBeenCalled();
  });
});
