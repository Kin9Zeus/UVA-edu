import { describe, expect, it } from "vitest";
import {
  LARGO_MAXIMO_BUSQUEDA,
  PAGINA_MAXIMA,
  numeroDePagina,
  parametroUnico,
  textoDeBusqueda,
} from "@/lib/parametros-url";

describe("parametroUnico", () => {
  it("devuelve el texto tal cual", () => {
    expect(parametroUnico("revit")).toBe("revit");
  });

  it("con el parámetro repetido (`?q=a&q=b`) se queda con el primero, como URLSearchParams.get()", () => {
    expect(parametroUnico(["a", "b"])).toBe("a");
  });

  it("ausente o arreglo vacío es undefined", () => {
    expect(parametroUnico(undefined)).toBeUndefined();
    expect(parametroUnico([])).toBeUndefined();
  });
});

describe("textoDeBusqueda", () => {
  it("recorta solo los extremos: los espacios internos no cambian el resultado de la búsqueda", () => {
    expect(textoDeBusqueda("  render   con vray  ")).toBe("render   con vray");
  });

  it("con el parámetro repetido usa el primero en vez de romper (era un 500 en producción)", () => {
    expect(textoDeBusqueda(["  bim ", "revit"])).toBe("bim");
  });

  it.each([
    ["ausente", undefined],
    ["vacío", ""],
    ["solo espacios", "   "],
    ["arreglo vacío", []],
  ])("%s → undefined (no hay nada que buscar)", (_caso, entrada) => {
    expect(textoDeBusqueda(entrada)).toBeUndefined();
  });

  it(`corta a ${LARGO_MAXIMO_BUSQUEDA} caracteres`, () => {
    const resultado = textoDeBusqueda("a".repeat(5000));
    expect(resultado).toHaveLength(LARGO_MAXIMO_BUSQUEDA);
  });

  it("no deja un espacio colgando si el corte cae justo después de uno", () => {
    const entrada = `${"a".repeat(LARGO_MAXIMO_BUSQUEDA - 1)} resto`;
    expect(textoDeBusqueda(entrada)).toBe("a".repeat(LARGO_MAXIMO_BUSQUEDA - 1));
  });

  it("corta por caracteres, sin partir un emoji por la mitad", () => {
    const resultado = textoDeBusqueda("🏗️".repeat(200)) ?? "";
    // Ningún sustituto UTF-16 suelto: el texto sigue siendo válido.
    expect(resultado.isWellFormed()).toBe(true);
    expect(Array.from(resultado).length).toBeLessThanOrEqual(LARGO_MAXIMO_BUSQUEDA);
  });
});

describe("numeroDePagina", () => {
  it.each([
    ["ausente", undefined, 1],
    ["vacío", "", 1],
    ["texto", "abc", 1],
    ["cero", "0", 1],
    ["negativa", "-3", 1],
    ["decimal", "2.7", 2],
    ["normal", "3", 3],
    ["repetida", ["4", "9"], 4],
    ["repetida con la primera inválida", ["abc", "9"], 1],
    ["por encima del tope", "99999", PAGINA_MAXIMA],
    ["notación científica", "1e3", PAGINA_MAXIMA],
    ["infinito", "Infinity", 1],
  ])("%s", (_caso, entrada, esperado) => {
    expect(numeroDePagina(entrada)).toBe(esperado);
  });

  it("acepta un número ya convertido y lo acota igual", () => {
    expect(numeroDePagina(1.5)).toBe(1);
    expect(numeroDePagina(-8)).toBe(1);
    expect(numeroDePagina(NaN)).toBe(1);
    expect(numeroDePagina(250)).toBe(PAGINA_MAXIMA);
  });

  it("respeta un tope distinto si se le pasa", () => {
    expect(numeroDePagina("30", 10)).toBe(10);
  });
});
