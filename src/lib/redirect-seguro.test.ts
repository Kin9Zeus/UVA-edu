import { describe, expect, it } from "vitest";
import { DESTINO_POR_DEFECTO, destinoInternoSeguro } from "@/lib/redirect-seguro";

/** Barra invertida literal, sin depender de cómo escape cada editor/shell. */
const BARRA_INVERTIDA = String.fromCharCode(92);

describe("destinoInternoSeguro", () => {
  describe("conserva las rutas internas", () => {
    it.each([
      ["/dashboard", "/dashboard"],
      ["/cursos/revit-basico", "/cursos/revit-basico"],
      ["/cursos/revit/clase-1?t=30#notas", "/cursos/revit/clase-1?t=30#notas"],
      ["/actualizar-password", "/actualizar-password"],
      // El registro manda aquí con `?signout=1&email=`: la query se conserva.
      ["/login?signout=1&email=a%40b.co", "/login?signout=1&email=a%40b.co"],
    ])("%s", (entrada, esperado) => {
      expect(destinoInternoSeguro(entrada)).toBe(esperado);
    });
  });

  describe("rechaza todo lo que sale del sitio", () => {
    it.each([
      ["relativa al protocolo", "//evil.example"],
      ["relativa al protocolo con ruta", "//evil.example/login"],
      ["barra + barra invertida", `/${BARRA_INVERTIDA}evil.example`],
      ["tab entre las barras (el parser lo descarta)", "/\t/evil.example"],
      ["salto de línea entre las barras", "/\n/evil.example"],
      ["retorno de carro entre las barras", "/\r/evil.example"],
      ["segmento `.` que normaliza a `//`", "/.//evil.example"],
      ["URL absoluta", "https://evil.example"],
      ["URL absoluta a nuestro propio dominio también", "https://uva.edu.co/dashboard"],
      ["esquema javascript:", "javascript:alert(1)"],
      ["espacio inicial", " //evil.example"],
      ["barras invertidas dobles", `${BARRA_INVERTIDA}${BARRA_INVERTIDA}evil.example`],
      ["ruta relativa", "dashboard"],
      ["vacío", ""],
    ])("%s", (_caso, entrada) => {
      expect(destinoInternoSeguro(entrada)).toBe(DESTINO_POR_DEFECTO);
    });
  });

  it("rechaza lo que no es string (FormData puede traer un File, o nada)", () => {
    expect(destinoInternoSeguro(null)).toBe(DESTINO_POR_DEFECTO);
    expect(destinoInternoSeguro(undefined)).toBe(DESTINO_POR_DEFECTO);
    expect(destinoInternoSeguro(new Blob(["//evil.example"]))).toBe(DESTINO_POR_DEFECTO);
  });

  it("usa el destino por defecto que se le pase", () => {
    expect(destinoInternoSeguro("//evil.example", "/")).toBe("/");
  });

  it("lo que devuelve nunca cambia de origen al resolverlo un navegador", () => {
    // Propiedad, no ejemplo: para todas las entradas hostiles de arriba y
    // algunas más, el resultado resuelto contra un origen real sigue en él.
    const origen = "https://uva.edu.co";
    const hostiles = [
      "//evil.example",
      `/${BARRA_INVERTIDA}evil.example`,
      "/\t/evil.example",
      "/.//evil.example",
      "/..//evil.example",
      "/%2F%2Fevil.example",
      "/././/evil.example",
      "/cursos/../..//evil.example",
    ];
    for (const entrada of hostiles) {
      const destino = destinoInternoSeguro(entrada);
      expect(new URL(destino, origen).origin, `entrada: ${JSON.stringify(entrada)}`).toBe(origen);
    }
  });
});
