import { describe, expect, it } from "vitest";
import { calcularDiasGracia } from "@/lib/gracia";

describe("calcularDiasGracia", () => {
  it("recién vencida: quedan los 5 días completos", () => {
    const ahora = new Date("2026-03-10T00:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(5);
  });

  it("a mitad de la ventana: redondea hacia arriba", () => {
    const ahora = new Date("2026-03-12T12:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(3);
  });

  it("justo en el límite: 0, no negativo", () => {
    const ahora = new Date("2026-03-15T00:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(0);
  });

  it("ya pasada la ventana: se queda en 0, nunca negativo", () => {
    const ahora = new Date("2026-04-01T00:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(0);
  });
});
