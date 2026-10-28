import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { resumirCanjes, type Canje } from "./codigos-uso";

// Martes 27 de octubre de 2026, 10:00 en Bogotá. La semana actual empieza el 26.
const AHORA = new Date("2026-10-27T15:00:00Z");

function canje(idUsuario: string, idCodigo: string, canjeadoEn: string, fechaRenovacion: string | null = null): Canje {
  return { idUsuario, idCodigo, canjeadoEn, estado: "ACTIVA", fechaRenovacion };
}

describe("resumirCanjes", () => {
  it("sin canjes: 12 semanas vacías y nadie con invitación", () => {
    const r = resumirCanjes([], new Set(), new Set(), AHORA);
    expect(r.semanas).toHaveLength(12);
    expect(r.semanas.every((s) => s.total === 0)).toBe(true);
    expect([r.canjes30, r.personas30, r.empezaron30, r.conInvitacion]).toEqual([0, 0, 0, 0]);
    expect(r.diasUltimoCanje).toBeNull();
  });

  it("una sola barra por semana y el reparto entre compartidos y de lote", () => {
    const r = resumirCanjes(
      [canje("ana", "compartido", "2026-10-26T14:00:00Z"), canje("luis", "del-lote", "2026-10-27T14:00:00Z")],
      new Set(["del-lote"]),
      new Set(),
      AHORA,
    );
    const actual = r.semanas.at(-1)!;
    expect(actual.porSerie).toEqual({ canjes: 2 });
    expect([actual.total, actual.compartidos, actual.deLote]).toEqual([2, 1, 1]);
    expect(r.diasUltimoCanje).toBe(0);
  });

  it("empezaron a estudiar: de quienes entraron en 30 días, los que tienen avance", () => {
    const r = resumirCanjes(
      [
        canje("ana", "a", "2026-10-20T15:00:00Z"),
        canje("luis", "a", "2026-10-21T15:00:00Z"),
        canje("eva", "b", "2026-08-01T15:00:00Z"),
      ],
      new Set(),
      new Set(["ana", "eva"]),
      AHORA,
    );
    expect([r.canjes30, r.personas30, r.empezaron30]).toEqual([2, 2, 1]);
    // Por código cuenta toda la historia, no solo 30 días.
    expect(r.estudianPorCodigo).toEqual({ a: 1, b: 1 });
  });

  it("acceso vigente por invitación y a quién se le acaba en 7 días", () => {
    const r = resumirCanjes(
      [
        canje("ana", "a", "2026-10-01T15:00:00Z", "2026-10-31T15:00:00Z"),
        canje("luis", "a", "2026-10-01T15:00:00Z", "2026-12-31T15:00:00Z"),
        canje("eva", "a", "2026-08-01T15:00:00Z", "2026-09-01T15:00:00Z"),
        { ...canje("leo", "a", "2026-10-01T15:00:00Z", "2026-12-31T15:00:00Z"), estado: "CANCELADA" },
      ],
      new Set(),
      new Set(),
      AHORA,
    );
    expect([r.conInvitacion, r.seLesAcaba]).toEqual([2, 1]);
  });
});
