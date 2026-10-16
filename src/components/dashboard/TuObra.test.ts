import { describe, expect, it } from "vitest";
import { calcularTorre } from "@/components/dashboard/TuObra";

describe("calcularTorre", () => {
  it("sin cursos terminados no hay pisos", () => {
    expect(calcularTorre(0)).toMatchObject({ entregadas: 0, pisos: 0 });
  });

  it("cada curso suma un piso hasta 5", () => {
    expect(calcularTorre(3)).toMatchObject({ entregadas: 0, pisos: 3 });
  });

  it("con 5 la torre se ve completa, no vacía", () => {
    const torre = calcularTorre(5);
    expect(torre).toMatchObject({ entregadas: 0, pisos: 5 });
    expect(torre.texto).toContain("Torre 1 entregada");
  });

  it("el sexto curso entrega la primera torre y empieza la segunda", () => {
    expect(calcularTorre(6)).toMatchObject({ entregadas: 1, pisos: 1 });
  });
});
