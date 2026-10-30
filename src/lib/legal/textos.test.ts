import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/supabase/public", () => import("@/test/servidor-falso").then((m) => m.moduloSupabasePublic()));
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

const { obtenerTextoVigente, obtenerTextoPorVersion, getSlugsConTextoVigente } = await import(
  "@/lib/legal/textos"
);
const { logError } = await import("@/lib/log");

const FILA = {
  slug: "terminos",
  version: "1.0",
  titulo: "Términos y condiciones de uso",
  contenido: [{ tipo: "parrafo", contenido: "Texto." }],
  estado: "PUBLICADO",
  vigente_desde: "2026-11-15T05:00:00+00:00",
  publicado_en: "2026-11-01T15:00:00+00:00",
};

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.clearAllMocks();
});

describe("obtenerTextoVigente", () => {
  it("devuelve el texto con sus bloques ya validados", async () => {
    servidorFalso.responder("from:textos_legales", { data: FILA, error: null });
    const texto = await obtenerTextoVigente("terminos");
    expect(texto).toMatchObject({ slug: "terminos", version: "1.0", estado: "PUBLICADO" });
    expect(texto?.bloques).toEqual([{ tipo: "parrafo", contenido: "Texto." }]);
  });

  it("pide solo lo PUBLICADO, ya vigente, lo más reciente primero, con el cliente público", async () => {
    servidorFalso.responder("from:textos_legales", { data: FILA, error: null });
    await obtenerTextoVigente("terminos");
    const [llamada] = servidorFalso.llamadasA("from:textos_legales");
    expect(llamada.cliente).toBe("publico");
    const cadena = llamada.cadena.map((c) => [c.metodo, ...c.argumentos]);
    expect(cadena).toContainEqual(["eq", "slug", "terminos"]);
    expect(cadena).toContainEqual(["eq", "estado", "PUBLICADO"]);
    expect(cadena).toContainEqual(["order", "vigente_desde", { ascending: false }]);
    expect(cadena.some(([metodo, columna]) => metodo === "lte" && columna === "vigente_desde")).toBe(true);
    expect(cadena).toContainEqual(["limit", 1]);
  });

  it("sin versión publicada devuelve null (la página da 404)", async () => {
    servidorFalso.responder("from:textos_legales", { data: null, error: null });
    expect(await obtenerTextoVigente("cookies")).toBeNull();
  });

  it("un ERROR de la consulta lanza: no se confunde con 'no existe'", async () => {
    servidorFalso.responder("from:textos_legales", { data: null, error: ERROR_PG });
    await expect(obtenerTextoVigente("terminos")).rejects.toThrow(/texto legal vigente \(terminos\) falló/);
  });

  it("un contenido corrupto lanza en vez de mostrarse a medias", async () => {
    servidorFalso.responder("from:textos_legales", {
      data: { ...FILA, contenido: [{ tipo: "html", contenido: "<script>" }] },
      error: null,
    });
    await expect(obtenerTextoVigente("terminos")).rejects.toThrow(/no es válido/);
  });

  it("un slug desconocido en la base lanza", async () => {
    servidorFalso.responder("from:textos_legales", { data: { ...FILA, slug: "otro" }, error: null });
    await expect(obtenerTextoVigente("terminos")).rejects.toThrow(/slug desconocido/);
  });
});

describe("obtenerTextoPorVersion", () => {
  it("usa el cliente de SESIÓN (RLS decide si es borrador visible) y no el público", async () => {
    servidorFalso.responder("from:textos_legales", { data: { ...FILA, estado: "BORRADOR", vigente_desde: null }, error: null });
    const texto = await obtenerTextoPorVersion("terminos", "1.0");
    expect(texto?.estado).toBe("BORRADOR");
    expect(servidorFalso.llamadasA("from:textos_legales")[0].cliente).toBe("sesion");
  });

  it("si RLS no deja ver la versión devuelve null", async () => {
    servidorFalso.responder("from:textos_legales", { data: null, error: null });
    expect(await obtenerTextoPorVersion("terminos", "9.9")).toBeNull();
  });

  it("un error lanza", async () => {
    servidorFalso.responder("from:textos_legales", { data: null, error: ERROR_PG });
    await expect(obtenerTextoPorVersion("terminos", "1.0")).rejects.toThrow(/falló/);
  });
});

describe("getSlugsConTextoVigente", () => {
  it("devuelve los textos publicados en el orden fijo, sin repetidos", async () => {
    servidorFalso.responder("from:textos_legales", {
      data: [{ slug: "cookies" }, { slug: "terminos" }, { slug: "terminos" }],
      error: null,
    });
    expect(await getSlugsConTextoVigente()).toEqual(["terminos", "cookies"]);
  });

  it("ante un fallo degrada a [] pero lo REGISTRA (nunca en silencio)", async () => {
    servidorFalso.responder("from:textos_legales", { data: null, error: ERROR_PG });
    expect(await getSlugsConTextoVigente()).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      "legal:publicados",
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ area: "legal" }),
    );
  });
});
