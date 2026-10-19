import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aRgba, leerTemas, medir, medirTodo, razon } from "./contraste";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("razon", () => {
  it("da 21:1 entre blanco y negro y 1:1 entre iguales", () => {
    expect(razon(aRgba("#ffffff"), aRgba("#000000"))).toBeCloseTo(21, 5);
    expect(razon(aRgba("#ff007a"), aRgba("#ff007a"))).toBeCloseTo(1, 5);
  });

  it("coincide con el valor conocido del magenta sobre blanco", () => {
    expect(razon(aRgba("#ff007a"), aRgba("#ffffff"))).toBeCloseTo(3.8, 1);
  });
});

describe("medir", () => {
  it("mezcla el texto translúcido con su fondo antes de medir", () => {
    const tokens = { "uva-a": "rgba(0, 0, 0, 0.5)", "uva-b": "#ffffff" };
    const m = medir(tokens, "claro", { tipo: "texto", frente: "uva-a", fondo: "uva-b", minimo: 4.5 });
    // Negro al 50 % sobre blanco es un gris de 127,5 en cada canal: 3,98:1.
    expect(m.ratio).toBeCloseTo(3.98, 2);
    expect(m.pasa).toBe(false);
  });

  it("resuelve tokens que apuntan a otro con var()", () => {
    const tokens = { "uva-link": "var(--uva-ink)", "uva-ink": "#000000", "uva-bg": "#ffffff" };
    const m = medir(tokens, "claro", { tipo: "texto", frente: "uva-link", fondo: "uva-bg", minimo: 4.5 });
    expect(m.ratio).toBeCloseTo(21, 5);
  });
});

describe("tokens de globals.css", () => {
  it("el tema oscuro redefine el fondo y hereda lo que no cambia", () => {
    const { claro, oscuro } = leerTemas(css);
    expect(oscuro["uva-bg"]).not.toBe(claro["uva-bg"]);
    expect(oscuro["uva-btn"]).toBe(claro["uva-btn"]);
  });

  it("todos los pares obligatorios pasan AA en los dos temas", () => {
    const fallas = medirTodo(css)
      .filter((m) => !m.pasa)
      .map((m) => `${m.tema}: --${m.frente} sobre --${m.fondo} da ${m.ratio.toFixed(2)} (mínimo ${m.minimo})`);
    expect(fallas).toEqual([]);
  });
});
