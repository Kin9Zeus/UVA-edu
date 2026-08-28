import { describe, expect, it } from "vitest";
import { BOM_UTF8, celdaCsv, construirCsv } from "@/lib/csv";

describe("celdaCsv", () => {
  it("envuelve en comillas y duplica las internas (RFC 4180)", () => {
    expect(celdaCsv('Ana "La Jefa" Pérez')).toBe('"Ana ""La Jefa"" Pérez"');
  });

  it("null y undefined salen como celda vacía, no como el texto 'null'", () => {
    expect(celdaCsv(null)).toBe('""');
    expect(celdaCsv(undefined)).toBe('""');
  });

  it("los números pasan tal cual", () => {
    expect(celdaCsv(0)).toBe('"0"');
    expect(celdaCsv(42)).toBe('"42"');
  });

  it("no toca un valor normal", () => {
    expect(celdaCsv("ana@uva.test")).toBe('"ana@uva.test"');
  });
});

/**
 * El nombre de usuario es entrada no confiable: lo escribe quien se registra.
 * Si sale sin neutralizar, Excel lo ejecuta como fórmula al abrir el archivo
 * y la exportación se convierte en un ataque contra el administrador que la
 * abre.
 */
describe("celdaCsv neutraliza la inyección de fórmulas", () => {
  const peligrosos = [
    ['=HYPERLINK("http://malo","Reclama tu premio")', "="],
    ["+1+1", "+"],
    ["-2-3", "-"],
    ["@SUM(A1:A9)", "@"],
    ["\tcmd", "tabulador"],
    ["\rcmd", "retorno de carro"],
  ] as const;

  for (const [entrada, prefijo] of peligrosos) {
    it(`antepone un apóstrofo a un valor que empieza por ${prefijo}`, () => {
      const salida = celdaCsv(entrada);
      expect(salida.startsWith("\"'")).toBe(true);
      // El contenido original se conserva: se neutraliza, no se censura.
      expect(salida).toContain(entrada.replace(/"/g, '""'));
    });
  }

  it("no antepone nada cuando el carácter peligroso no está al inicio", () => {
    expect(celdaCsv("a=b")).toBe('"a=b"');
  });
});

describe("construirCsv", () => {
  it("abre con BOM para que Excel lea UTF-8 y no rompa las tildes", () => {
    expect(construirCsv(["Nombre"], [["Pérez"]]).startsWith(BOM_UTF8)).toBe(true);
  });

  it("separa con punto y coma y termina las líneas con CRLF", () => {
    const csv = construirCsv(["A", "B"], [["1", "2"]]);
    expect(csv).toBe(`${BOM_UTF8}"A";"B"\r\n"1";"2"`);
  });

  it("sin filas deja solo la cabecera", () => {
    expect(construirCsv(["A"], [])).toBe(`${BOM_UTF8}"A"`);
  });
});
