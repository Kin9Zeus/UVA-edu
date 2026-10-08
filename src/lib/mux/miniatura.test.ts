import { describe, expect, it, vi } from "vitest";

const { signPlaybackId } = vi.hoisted(() => ({ signPlaybackId: vi.fn(async () => "TOKEN") }));
vi.mock("@/lib/mux/client", () => ({ mux: { jwt: { signPlaybackId } } }));
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

import { getMiniaturaUrl } from "@/lib/mux/miniatura";

describe("getMiniaturaUrl", () => {
  // Con un playback ID firmado, Mux ignora los parámetros que no van en el
  // token: si `width` se saliera de ahí volvería el frame a resolución completa.
  it("pide el ancho y el segundo dentro del token, en webp", async () => {
    const url = await getMiniaturaUrl("abc", 160, 42.7);
    expect(signPlaybackId).toHaveBeenCalledWith("abc", expect.objectContaining({
      type: "thumbnail",
      params: { width: "160", time: "42" },
    }));
    expect(url).toBe("https://image.mux.com/abc/thumbnail.webp?token=TOKEN");
  });
});
