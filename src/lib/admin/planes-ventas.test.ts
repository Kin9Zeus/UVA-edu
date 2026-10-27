import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { resumirVentasPlanes, type IntentoDePlan } from "./planes-ventas";

// Martes 27 de octubre de 2026, 10:00 en Bogotá. La semana actual empieza el 26.
const AHORA = new Date("2026-10-27T15:00:00Z");
const planes = [
  { id: "mensual", nombre: "Mensual" },
  { id: "anual", nombre: "Anual" },
];

function intento(idPlan: string, actualizadoEn: string, cambios: Partial<IntentoDePlan> = {}): IntentoDePlan {
  return { idPlan, estado: "APROBADO", montoCentavos: 8_990_000, moneda: "COP", actualizadoEn, ...cambios };
}

describe("resumirVentasPlanes", () => {
  it("sin datos: 12 semanas vacías y todo en cero", () => {
    const ventas = resumirVentasPlanes([], [], planes, AHORA);
    expect(ventas.semanas).toHaveLength(12);
    expect(ventas.semanas.every((s) => s.total === 0 && s.ventas === 0)).toBe(true);
    expect(ventas.series).toEqual([]);
    expect([ventas.vigentes, ventas.ventas30, ventas.intentos30, ventas.recaudadoCop]).toEqual([0, 0, 0, 0]);
  });

  it("la gráfica suma plata en pesos por plan y cuenta las ventas aparte", () => {
    const ventas = resumirVentasPlanes(
      [
        intento("mensual", "2026-10-26T15:00:00Z"),
        intento("mensual", "2026-10-27T13:00:00Z"),
        intento("anual", "2026-10-26T20:00:00Z", { montoCentavos: 89_900_000 }),
        intento("anual", "2026-10-26T21:00:00Z", { estado: "RECHAZADO", montoCentavos: 89_900_000 }),
        intento("anual", "2026-10-26T22:00:00Z", { moneda: "USD", montoCentavos: 19_900 }),
      ],
      [],
      planes,
      AHORA,
    );
    const actual = ventas.semanas.at(-1)!;
    expect(actual.porSerie).toEqual({ mensual: 17_980_000, anual: 89_900_000 });
    expect(actual.ventasPorSerie).toEqual({ mensual: 2, anual: 1 });
    expect(actual.total).toBe(107_880_000);
    expect(actual.ventas).toBe(3);
    // El aprobado en dólares cuenta como venta, pero no entra en pesos.
    expect(ventas.fueraDeGrafica).toBe(1);
    expect(ventas.ventas30).toBe(4);
    expect(ventas.porPlan.anual.ventas30).toBe(2);
    expect(ventas.recaudadoCop).toBe(107_880_000);
    expect(ventas.intentos30).toBe(5);
  });

  it("las cifras cuentan solo los últimos 30 días, y la gráfica las 12 semanas", () => {
    const ventas = resumirVentasPlanes(
      [intento("mensual", "2026-09-27T15:00:00Z"), intento("mensual", "2026-09-28T15:00:00Z")],
      [],
      planes,
      AHORA,
    );
    expect(ventas.ventas30).toBe(1);
    expect(ventas.semanas.reduce((suma, s) => suma + s.ventas, 0)).toBe(2);
  });

  it("los colores siguen la posición del plan, no quién vende más", () => {
    const ventas = resumirVentasPlanes(
      [intento("anual", "2026-10-26T15:00:00Z", { montoCentavos: 89_900_000 }), intento("mensual", "2026-10-26T15:00:00Z")],
      [],
      planes,
      AHORA,
    );
    expect(ventas.series.map((s) => [s.clave, s.color])).toEqual([
      ["mensual", "var(--uva-serie-1)"],
      ["anual", "var(--uva-serie-2)"],
    ]);
  });

  it("cuenta las membresías pagadas vigentes y las que vencen en 7 días", () => {
    const ventas = resumirVentasPlanes(
      [],
      [
        { idPlan: "mensual", fechaRenovacion: "2026-10-30T15:00:00Z" },
        { idPlan: "mensual", fechaRenovacion: "2026-11-20T15:00:00Z" },
        { idPlan: "anual", fechaRenovacion: "2027-06-01T15:00:00Z" },
        { idPlan: null, fechaRenovacion: "2026-11-01T15:00:00Z" },
      ],
      planes,
      AHORA,
    );
    expect(ventas.vigentes).toBe(4);
    expect(ventas.vencen).toBe(2);
    expect(ventas.porPlan.mensual).toEqual({ vigentes: 2, vencen: 1, ventas30: 0 });
    expect(ventas.porPlan.anual).toEqual({ vigentes: 1, vencen: 0, ventas30: 0 });
  });
});
