import { NotFoundError } from "@mux/mux-node";
import { describe, expect, it, vi } from "vitest";
import { eliminarAssetMux } from "@/lib/mux/limpieza";

describe("eliminarAssetMux", () => {
  it("borrado exitoso: ok:true, llama a borrar con el assetId", async () => {
    const borrar = vi.fn().mockResolvedValue(undefined);
    const resultado = await eliminarAssetMux("asset-123", borrar);
    expect(resultado).toEqual({ ok: true });
    expect(borrar).toHaveBeenCalledWith("asset-123");
  });

  it("404 (el asset ya no existe): cuenta como éxito, para que reintentar sea idempotente", async () => {
    const error404 = new NotFoundError(404, { error: "not found" }, "not found", new Headers());
    const borrar = vi.fn().mockRejectedValue(error404);
    const resultado = await eliminarAssetMux("asset-ya-borrado", borrar);
    expect(resultado).toEqual({ ok: true });
  });

  it("otro error (ej. red, credenciales): ok:false, con el error para loguear", async () => {
    const errorRed = new Error("fetch failed");
    const borrar = vi.fn().mockRejectedValue(errorRed);
    const resultado = await eliminarAssetMux("asset-456", borrar);
    expect(resultado).toEqual({ ok: false, error: errorRed });
  });
});
