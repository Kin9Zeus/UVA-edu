import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COLOR_BARRA_NAVEGADOR,
  SCRIPT_TEMA_INICIAL,
  TEMA_STORAGE_KEY,
  aplicarTema,
  guardarPreferencia,
  leerPreferencia,
  parsearPreferencia,
  resolverTema,
  suscribirTema,
} from "@/lib/tema";

/** Navegador mínimo: localStorage, matchMedia y un <html> con clases. */
function navegadorFalso({ guardado = null as string | null, sistemaOscuro = false, storageRoto = false } = {}) {
  const almacen = new Map<string, string>(guardado ? [[TEMA_STORAGE_KEY, guardado]] : []);
  const clases = new Set<string>();
  const metas = [{ content: "" }, { content: "" }].map((m) => ({
    ...m,
    setAttribute(_n: string, v: string) {
      this.content = v;
    },
  }));
  const oyentesMedia = new Set<() => void>();
  const oyentesVentana = new Map<string, Set<(e: unknown) => void>>();
  const roto = () => {
    throw new Error("SecurityError");
  };
  const localStorage = {
    getItem: storageRoto ? roto : (k: string) => almacen.get(k) ?? null,
    setItem: storageRoto ? roto : (k: string, v: string) => void almacen.set(k, v),
    removeItem: storageRoto ? roto : (k: string) => void almacen.delete(k),
  };
  const media = {
    get matches() {
      return estado.sistemaOscuro;
    },
    addEventListener: (_: string, f: () => void) => oyentesMedia.add(f),
    removeEventListener: (_: string, f: () => void) => oyentesMedia.delete(f),
  };
  const estado = { sistemaOscuro };
  const window = {
    localStorage,
    matchMedia: () => media,
    addEventListener: (t: string, f: (e: unknown) => void) => {
      if (!oyentesVentana.has(t)) oyentesVentana.set(t, new Set());
      oyentesVentana.get(t)!.add(f);
    },
    removeEventListener: (t: string, f: (e: unknown) => void) => oyentesVentana.get(t)?.delete(f),
    dispatchEvent: (e: { type: string }) => oyentesVentana.get(e.type)?.forEach((f) => f(e)),
  };
  const document = {
    documentElement: {
      style: { colorScheme: "" },
      classList: { toggle: (c: string, on: boolean) => (on ? clases.add(c) : clases.delete(c)) },
    },
    querySelectorAll: () => metas,
  };
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("localStorage", localStorage);
  return {
    almacen,
    clases,
    metas,
    document,
    cambiarSistema(oscuro: boolean) {
      estado.sistemaOscuro = oscuro;
      oyentesMedia.forEach((f) => f());
    },
    emitirStorage(key: string | null) {
      oyentesVentana.get("storage")?.forEach((f) => f({ key }));
    },
    oyentes: () => oyentesMedia.size + [...oyentesVentana.values()].reduce((n, s) => n + s.size, 0),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("parsearPreferencia / resolverTema", () => {
  it.each([
    ["claro", "claro"],
    ["oscuro", "oscuro"],
    [null, "sistema"],
    ["", "sistema"],
    ["dark", "sistema"],
    ["CLARO", "sistema"],
  ] as const)("%j se lee como %s", (valor, esperado) => {
    expect(parsearPreferencia(valor)).toBe(esperado);
  });

  it("'sistema' sigue a prefers-color-scheme", () => {
    expect(resolverTema("sistema", true)).toBe("oscuro");
    expect(resolverTema("sistema", false)).toBe("claro");
  });

  it("una elección manual sobrescribe al sistema", () => {
    expect(resolverTema("claro", true)).toBe("claro");
    expect(resolverTema("oscuro", false)).toBe("oscuro");
  });
});

describe("SCRIPT_TEMA_INICIAL (corre en el <head> antes de pintar)", () => {
  function correrScript() {
    new Function(SCRIPT_TEMA_INICIAL)();
  }

  it.each([
    [null, true, true],
    [null, false, false],
    ["claro", true, false],
    ["oscuro", false, true],
    ["basura", true, true],
  ] as const)("guardado=%j, sistema oscuro=%s → .dark=%s", (guardado, sistemaOscuro, esperado) => {
    const nav = navegadorFalso({ guardado, sistemaOscuro });
    correrScript();
    expect(nav.clases.has("dark")).toBe(esperado);
    expect(nav.document.documentElement.style.colorScheme).toBe(esperado ? "dark" : "light");
  });

  it("si localStorage lanza (ventana privada), sigue al sistema sin romper", () => {
    const nav = navegadorFalso({ sistemaOscuro: true, storageRoto: true });
    expect(correrScript).not.toThrow();
    expect(nav.clases.has("dark")).toBe(true);
  });
});

describe("guardarPreferencia", () => {
  it("guarda la elección manual en localStorage y la aplica", () => {
    const nav = navegadorFalso({ sistemaOscuro: true });
    guardarPreferencia("claro");
    expect(nav.almacen.get(TEMA_STORAGE_KEY)).toBe("claro");
    expect(nav.clases.has("dark")).toBe(false);
    expect(nav.metas.map((m) => m.content)).toEqual([COLOR_BARRA_NAVEGADOR.claro, COLOR_BARRA_NAVEGADOR.claro]);
  });

  it("'sistema' borra la clave y vuelve a seguir al sistema", () => {
    const nav = navegadorFalso({ guardado: "claro", sistemaOscuro: true });
    guardarPreferencia("sistema");
    expect(nav.almacen.has(TEMA_STORAGE_KEY)).toBe(false);
    expect(nav.clases.has("dark")).toBe(true);
    expect(leerPreferencia()).toBe("sistema");
  });

  it("sin almacenamiento aplica igual el tema de esta visita", () => {
    const nav = navegadorFalso({ storageRoto: true });
    expect(() => guardarPreferencia("oscuro")).not.toThrow();
    expect(nav.clases.has("dark")).toBe(true);
    expect(leerPreferencia()).toBe("sistema");
  });
});

describe("suscribirTema", () => {
  it("en modo sistema, un cambio del sistema re-aplica el tema y avisa", () => {
    const nav = navegadorFalso({ sistemaOscuro: false });
    const aviso = vi.fn();
    suscribirTema(aviso);
    nav.cambiarSistema(true);
    expect(nav.clases.has("dark")).toBe(true);
    expect(aviso).toHaveBeenCalled();
  });

  it("con elección manual, un cambio del sistema no la pisa", () => {
    const nav = navegadorFalso({ guardado: "claro", sistemaOscuro: false });
    suscribirTema(vi.fn());
    nav.cambiarSistema(true);
    expect(nav.clases.has("dark")).toBe(false);
  });

  it("avisa cuando se guarda una preferencia en esta pestaña", () => {
    navegadorFalso();
    const aviso = vi.fn();
    suscribirTema(aviso);
    guardarPreferencia("oscuro");
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("aplica lo que otra pestaña guardó (evento storage)", () => {
    const nav = navegadorFalso({ sistemaOscuro: false });
    suscribirTema(vi.fn());
    nav.almacen.set(TEMA_STORAGE_KEY, "oscuro");
    nav.emitirStorage(TEMA_STORAGE_KEY);
    expect(nav.clases.has("dark")).toBe(true);
  });

  it("al desuscribirse no deja oyentes colgados", () => {
    const nav = navegadorFalso();
    const quitar = suscribirTema(vi.fn());
    expect(nav.oyentes()).toBe(3);
    quitar();
    expect(nav.oyentes()).toBe(0);
  });
});

describe("aplicarTema", () => {
  it("no falla sin navegador", () => {
    expect(() => aplicarTema("claro")).not.toThrow();
  });
});
