import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { CUPONES_SEMANAS, resumirUsoCupones, type IntentoConCupon } from "./cupones-uso";

// Martes 27 de octubre de 2026, 10:00 en Bogotá.
const AHORA = new Date("2026-10-27T15:00:00Z");

function intento(idCupon: string, actualizadoEn: string, cambios: Partial<IntentoConCupon> = {}): IntentoConCupon {
  return { idCupon, estado: "APROBADO", montoCentavos: 7_192_000, moneda: "COP", actualizadoEn, ...cambios };
}

const cupones = ["A", "B", "C", "D", "E"].map((codigo, i) => ({
  id: codigo.toLowerCase(),
  codigo,
  creadoEn: `2026-0${i + 1}-01T00:00:00Z`,
}));

describe("resumirUsoCupones", () => {
  it("arma 12 semanas que empiezan en lunes y terminan en la actual", () => {
    const { semanas } = resumirUsoCupones([], cupones, 0, AHORA);
    expect(semanas).toHaveLength(CUPONES_SEMANAS);
    expect(semanas.at(-1)!.inicio).toBe("2026-10-26");
    expect(semanas[0].inicio).toBe("2026-08-10");
  });

  it("cuenta solo los aprobados como usos, y todos los intentos como 'lo aplicaron'", () => {
    const uso = resumirUsoCupones(
      [
        intento("a", "2026-10-26T15:00:00Z"),
        intento("a", "2026-10-26T16:00:00Z", { estado: "RECHAZADO" }),
        intento("a", "2026-10-26T17:00:00Z", { estado: "PENDIENTE" }),
      ],
      cupones,
      5,
      AHORA,
    );
    expect(uso.aplicaron.a).toBe(3);
    expect(uso.semanas.at(-1)!.total).toBe(1);
    expect(uso.pagosConCupon).toBe(1);
    expect(uso.pagosTotales).toBe(5);
  });

  it("corta la semana en hora de Colombia: domingo 23:00 en Bogotá es la semana anterior", () => {
    // 04:00 UTC del lunes 26 = 23:00 del domingo 25 en Bogotá.
    const { semanas } = resumirUsoCupones([intento("a", "2026-10-26T04:00:00Z")], cupones, 1, AHORA);
    expect(semanas.at(-2)!.total).toBe(1);
    expect(semanas.at(-1)!.total).toBe(0);
  });

  it("nombra hasta 4 cupones, junta el resto en 'Otros' y da el color por antigüedad", () => {
    const usos = [
      ...Array(5).fill("e"),
      ...Array(4).fill("d"),
      ...Array(3).fill("c"),
      ...Array(2).fill("b"),
      "a",
    ].map((id) => intento(id, "2026-10-20T15:00:00Z"));
    const { series, semanas } = resumirUsoCupones(usos, cupones, 15, AHORA);
    expect(series.map((s) => s.nombre)).toEqual(["B", "C", "D", "E", "Otros"]);
    expect(series[0].color).toBe("var(--uva-serie-1)");
    expect(semanas.at(-2)!.porSerie.otros).toBe(1);
  });

  it("suma solo pesos en lo recaudado y solo los últimos 30 días", () => {
    const uso = resumirUsoCupones(
      [
        intento("a", "2026-10-20T15:00:00Z"),
        intento("a", "2026-10-20T15:00:00Z", { moneda: "USD", montoCentavos: 5_000 }),
        intento("a", "2026-09-01T15:00:00Z"),
      ],
      cupones,
      3,
      AHORA,
    );
    expect(uso.recaudadoCop).toBe(7_192_000);
    expect(uso.pagosConCupon).toBe(2);
  });
});
