import { describe, expect, it } from "vitest";
import { ESPACIO_ORDEN, ordenEntre, siguienteOrden } from "@/lib/orden";

describe("siguienteOrden", () => {
  it("empieza en el espacio base cuando no hay elementos (null)", () => {
    expect(siguienteOrden(null)).toBe(ESPACIO_ORDEN);
  });

  it("suma el espacio al último orden existente", () => {
    expect(siguienteOrden(30)).toBe(40);
  });

  it("funciona igual si el último orden es 0", () => {
    expect(siguienteOrden(0)).toBe(ESPACIO_ORDEN);
  });
});

describe("ordenEntre", () => {
  it("primer elemento de una lista vacía: usa el espacio base", () => {
    expect(ordenEntre(null, null)).toBe(ESPACIO_ORDEN);
  });

  it("insertar al principio (sin anterior): resta el espacio del siguiente", () => {
    // anterior=null se trata como base 0; el punto medio entre 0 y 10 es 5.
    expect(ordenEntre(null, 10)).toBe(5);
  });

  it("insertar al final (sin siguiente): suma el espacio al anterior", () => {
    expect(ordenEntre(20, null)).toBe(30);
  });

  it("insertar en medio con hueco suficiente: punto medio exacto", () => {
    expect(ordenEntre(10, 30)).toBe(20);
  });

  it("sin hueco entre vecinos consecutivos: no hay dónde insertar", () => {
    expect(ordenEntre(10, 11)).toBeNull();
  });

  it("vecinos idénticos: tampoco hay hueco", () => {
    expect(ordenEntre(10, 10)).toBeNull();
  });

  it("hueco de solo 1 (ej. 10 y 12): el medio cae fuera del rango abierto", () => {
    // floor((10+12)/2) = 11, que sí es estrictamente mayor que 10 y menor
    // que 12 — este caso SÍ tiene hueco.
    expect(ordenEntre(10, 12)).toBe(11);
  });
});
