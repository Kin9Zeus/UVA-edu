import { afterEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COOKIE, guardarSidebarColapsado } from "@/lib/sidebar-preferencia";

const cookiesMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookiesMock }));

import { leerSidebarColapsado } from "@/lib/sidebar-preferencia-servidor";

describe("guardarSidebarColapsado", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("guarda la cookie por un año, para todo el sitio, cuando se colapsa", () => {
    const doc = { cookie: "" };
    vi.stubGlobal("document", doc);
    guardarSidebarColapsado(true);
    expect(doc.cookie).toBe(`${SIDEBAR_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`);
  });

  it("borra la cookie cuando se expande (max-age=0)", () => {
    const doc = { cookie: "" };
    vi.stubGlobal("document", doc);
    guardarSidebarColapsado(false);
    expect(doc.cookie).toBe(`${SIDEBAR_COOKIE}=; path=/; max-age=0; SameSite=Lax`);
  });

  it("no falla si se llama sin navegador", () => {
    expect(() => guardarSidebarColapsado(true)).not.toThrow();
  });
});

describe("leerSidebarColapsado", () => {
  it("es true solo con la cookie en '1'", async () => {
    cookiesMock.get.mockReturnValue({ value: "1" });
    expect(await leerSidebarColapsado()).toBe(true);
    expect(cookiesMock.get).toHaveBeenCalledWith(SIDEBAR_COOKIE);
  });

  it.each([[undefined], [{ value: "" }], [{ value: "0" }], [{ value: "true" }]])(
    "es false con %j",
    async (valor) => {
      cookiesMock.get.mockReturnValue(valor);
      expect(await leerSidebarColapsado()).toBe(false);
    },
  );
});
