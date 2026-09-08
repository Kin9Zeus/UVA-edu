import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
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

/**
 * Prueba estructural, no de comportamiento.
 *
 * El chequeo empezó cubriendo los dos puntos que fijaban contraseña
 * (registro.ts y actualizar-password.ts). En la misma sesión en que se
 * escribió apareció un TERCERO —`perfil/cambiar-password.ts`, el cambio desde
 * Mi perfil— traído por otra rama, y estuvo a punto de quedarse sin él.
 *
 * Ese es el modo de fallo real de esta defensa: no que la función esté mal,
 * sino que alguien añada una puerta nueva y no se acuerde. Y una sola puerta
 * sin el chequeo basta para que una cuenta acabe con una contraseña que está
 * en la lista de cualquier atacante — no hay "cubierto a medias" acá.
 *
 * El criterio es `isPasswordValid`: si una Server Action valida la forma de
 * una contraseña, es porque está fijando una, y entonces también le toca
 * mirar si está filtrada.
 */
function archivosDeAcciones(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      archivosDeAcciones(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("toda acción que fija una contraseña comprueba si está filtrada", () => {
  it("no hay ninguna que valide con isPasswordValid y se salte esPasswordFiltrada", () => {
    const descubiertas = archivosDeAcciones(join(process.cwd(), "src", "actions"))
      .filter((ruta) => {
        const fuente = readFileSync(ruta, "utf8");
        return fuente.includes("isPasswordValid") && !fuente.includes("esPasswordFiltrada");
      })
      .map((ruta) => relative(process.cwd(), ruta).split("\\").join("/"));

    expect(descubiertas).toEqual([]);
  });

  it("encuentra de verdad los archivos que debe vigilar (si no, la de arriba pasa vacía)", () => {
    const vigilados = archivosDeAcciones(join(process.cwd(), "src", "actions")).filter((ruta) =>
      readFileSync(ruta, "utf8").includes("isPasswordValid"),
    );

    expect(vigilados.length).toBeGreaterThanOrEqual(3);
  });
});
