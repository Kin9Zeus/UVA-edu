import { describe, expect, it } from "vitest";
import { calcularRacha, hoyEnBogota, semanasDeActividad } from "@/lib/racha";

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

describe("semanasDeActividad", () => {
  // 2026-10-16 es viernes: la semana actual empieza el lunes 12.
  const hoy = "2026-10-16";

  it("devuelve 4 semanas de lunes, la última es la actual", () => {
    const semanas = semanasDeActividad([], hoy);
    expect(semanas.map((s) => s.inicio)).toEqual(["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(semanas.map((s) => s.esActual)).toEqual([false, false, false, true]);
  });

  it("cuenta los días con avance de cada semana", () => {
    const semanas = semanasDeActividad(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-11", "2026-09-21"], hoy);
    expect(semanas.map((s) => s.dias)).toEqual([1, 0, 1, 3]);
  });
});
