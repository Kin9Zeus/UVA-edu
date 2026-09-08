import { afterEach, describe, expect, it, vi } from "vitest";
import { esPasswordFiltrada } from "@/lib/password-filtrada";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

const PASSWORD = "Password123!";

/** El mismo cálculo que hace el módulo, para armar respuestas coherentes. */
async function hashDe(texto: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(texto));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return { prefijo: hex.slice(0, 5), sufijo: hex.slice(5) };
}

function respuesta(cuerpo: string, ok = true, status = 200) {
  return { ok, status, text: async () => cuerpo } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("esPasswordFiltrada", () => {
  it("detecta una contraseña que aparece en la respuesta con más de 0 apariciones", async () => {
    const { sufijo } = await hashDe(PASSWORD);
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(`${sufijo}:24230\r\nAAAA:5`)));

    expect(await esPasswordFiltrada(PASSWORD)).toBe(true);
  });

  /**
   * Lo que de verdad hay que garantizar: la contraseña nunca sale de acá.
   * `Add-Padding` no es decorativo — sin él, el tamaño de la respuesta delata
   * cuántas coincidencias reales tenía el prefijo.
   */
  it("solo manda los 5 primeros caracteres del hash, nunca la contraseña ni el hash completo", async () => {
    const { prefijo, sufijo } = await hashDe(PASSWORD);
    let url = "";
    let opciones: RequestInit = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string, o: RequestInit) => {
        url = u;
        opciones = o;
        return respuesta("");
      }),
    );

    await esPasswordFiltrada(PASSWORD);
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${prefijo}`);
    expect(url).not.toContain(sufijo);
    expect(url).not.toContain(PASSWORD);
    expect((opciones.headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });

  /**
   * Las entradas de relleno de Add-Padding vienen con `count = 0`. Contarlas
   * como coincidencia rechazaría contraseñas perfectamente buenas, y el fallo
   * sería invisible: el usuario solo vería "elige otra".
   */
  it("ignora las entradas de relleno, que llegan con 0 apariciones", async () => {
    const { sufijo } = await hashDe(PASSWORD);
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(`${sufijo}:0`)));

    expect(await esPasswordFiltrada(PASSWORD)).toBe(false);
  });

  it("devuelve false cuando el sufijo no está en la lista", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta("0000000000000000000000000000000000A:3")));

    expect(await esPasswordFiltrada(PASSWORD)).toBe(false);
  });

  // Falla abierto: tumbar el registro porque un tercero está caído es peor
  // que el riesgo que esta capa evita.
  it("deja pasar si la red falla", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ETIMEDOUT"); }));

    expect(await esPasswordFiltrada(PASSWORD)).toBe(false);
  });

  it("deja pasar si HIBP responde con error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta("", false, 503)));

    expect(await esPasswordFiltrada(PASSWORD)).toBe(false);
  });
});
