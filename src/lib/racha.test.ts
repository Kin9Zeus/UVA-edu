import { describe, expect, it } from "vitest";
import { calcularRacha, hoyEnBogota } from "@/lib/racha";

describe("calcularRacha", () => {
  it("cuenta los días seguidos que terminan hoy", () => {
    expect(calcularRacha(["2026-10-14", "2026-10-15", "2026-10-16"], "2026-10-16")).toBe(3);
  });

  it("sigue viva si el último día fue ayer", () => {
    expect(calcularRacha(["2026-10-14", "2026-10-15"], "2026-10-16")).toBe(2);
  });

  it("se corta con un día sin avance", () => {
    expect(calcularRacha(["2026-10-12", "2026-10-14", "2026-10-15", "2026-10-16"], "2026-10-16")).toBe(3);
  });

  it("es 0 si el último día fue antes de ayer o no hay días", () => {
    expect(calcularRacha(["2026-10-13"], "2026-10-16")).toBe(0);
    expect(calcularRacha([], "2026-10-16")).toBe(0);
  });

  it("cruza el cambio de mes", () => {
    expect(calcularRacha(["2026-09-30", "2026-10-01"], "2026-10-01")).toBe(2);
  });
});

describe("hoyEnBogota", () => {
  it("a las 11 p. m. de Bogotá ya es el día siguiente en UTC, pero cuenta el de Bogotá", () => {
    expect(hoyEnBogota(new Date("2026-10-17T04:00:00Z"))).toBe("2026-10-16");
  });
});
