import { afterEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COOKIE, guardarSidebarColapsado } from "@/lib/sidebar-preferencia";

const cookiesMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookiesMock }));

import { leerPreferenciaSidebar } from "@/lib/sidebar-preferencia-servidor";

describe("guardarSidebarColapsado", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("guarda la cookie por un año, para todo el sitio, cuando se colapsa", () => {
    const doc = { cookie: "" };
    vi.stubGlobal("document", doc);
    guardarSidebarColapsado(true);
    expect(doc.cookie).toBe(`${SIDEBAR_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`);
  });

  it("guarda '0' cuando se expande: es una elección, no la ausencia de una", () => {
    const doc = { cookie: "" };
    vi.stubGlobal("document", doc);
    guardarSidebarColapsado(false);
    expect(doc.cookie).toBe(`${SIDEBAR_COOKIE}=0; path=/; max-age=31536000; SameSite=Lax`);
  });

  it("no falla si se llama sin navegador", () => {
    expect(() => guardarSidebarColapsado(true)).not.toThrow();
  });
});

describe("leerPreferenciaSidebar", () => {
  it.each([
    [{ value: "1" }, "colapsado"],
    [{ value: "0" }, "expandido"],
    [undefined, null],
    [{ value: "" }, null],
    [{ value: "true" }, null],
  ])("%j es %s", async (valor, esperado) => {
    cookiesMock.get.mockReturnValue(valor);
    expect(await leerPreferenciaSidebar()).toBe(esperado);
  });
});
