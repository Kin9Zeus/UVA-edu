import { afterEach, describe, expect, it, vi } from "vitest";
import { COLOR_BARRA_NAVEGADOR, TEMA_COOKIE, aplicarTema, parsearTema } from "@/lib/tema";

const cookiesMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookiesMock }));

import { leerTema } from "@/lib/tema-servidor";

describe("parsearTema", () => {
  it("devuelve claro solo con el valor exacto 'claro'", () => {
    expect(parsearTema("claro")).toBe("claro");
  });

  it.each([[undefined], [null], [""], ["oscuro"], ["light"], ["CLARO"], ["dark"]])(
    "cae a oscuro con %j",
    (valor) => {
      expect(parsearTema(valor)).toBe("oscuro");
    },
  );
});

describe("leerTema", () => {
  it("lee la cookie del tema", async () => {
    cookiesMock.get.mockReturnValue({ value: "claro" });
    expect(await leerTema()).toBe("claro");
    expect(cookiesMock.get).toHaveBeenCalledWith(TEMA_COOKIE);
  });

  it("es oscuro sin cookie", async () => {
    cookiesMock.get.mockReturnValue(undefined);
    expect(await leerTema()).toBe("oscuro");
  });
});

describe("aplicarTema", () => {
  afterEach(() => vi.unstubAllGlobals());

  function documentoFalso() {
    const clases = new Set<string>(["dark"]);
    const metas: Record<string, { content: string; setAttribute: (n: string, v: string) => void }> = {};
    for (const nombre of ["theme-color", "color-scheme"]) {
      const meta = {
        content: "",
        setAttribute(_n: string, v: string) {
          meta.content = v;
        },
      };
      metas[nombre] = meta;
    }
    const doc = {
      cookie: "",
      documentElement: {
        style: { colorScheme: "" },
        classList: {
          toggle: (clase: string, activa: boolean) => (activa ? clases.add(clase) : clases.delete(clase)),
        },
      },
      querySelector: (selector: string) => metas[/name="([^"]+)"/.exec(selector)?.[1] ?? ""] ?? null,
    };
    return { doc, clases, metas };
  }

  it("pasa a claro: quita .dark, ajusta color-scheme y la barra, y guarda la cookie un año", () => {
    const { doc, clases, metas } = documentoFalso();
    vi.stubGlobal("document", doc);
    aplicarTema("claro");
    expect(clases.has("dark")).toBe(false);
    expect(doc.documentElement.style.colorScheme).toBe("light");
    expect(metas["theme-color"].content).toBe(COLOR_BARRA_NAVEGADOR.claro);
    expect(metas["color-scheme"].content).toBe("light");
    expect(doc.cookie).toBe(`${TEMA_COOKIE}=claro; path=/; max-age=31536000; SameSite=Lax`);
  });

  it("vuelve a oscuro poniendo .dark", () => {
    const { doc, clases } = documentoFalso();
    vi.stubGlobal("document", doc);
    aplicarTema("claro");
    aplicarTema("oscuro");
    expect(clases.has("dark")).toBe(true);
    expect(doc.documentElement.style.colorScheme).toBe("dark");
  });

  it("no falla si se llama sin navegador", () => {
    expect(() => aplicarTema("claro")).not.toThrow();
  });
});
