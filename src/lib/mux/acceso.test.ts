import { describe, expect, it } from "vitest";
import { tieneAccesoVigente } from "@/lib/mux/acceso";

const AHORA = new Date("2026-09-03T20:00:00Z"); // 15:00 del 3 de septiembre en Bogotá
const EN_CURSO = "2026-09-20T05:00:00Z";
const YA_PASADA = "2026-08-20T05:00:00Z";

describe("tieneAccesoVigente", () => {
  it("permite con suscripción ACTIVA vigente aunque no haya cortesía", () => {
    expect(
      tieneAccesoVigente({ estado: "ACTIVA", fechaRenovacion: EN_CURSO }, false, AHORA),
    ).toBe(true);
  });

  it("permite con suscripción PAST_DUE dentro del período de gracia", () => {
    expect(
      tieneAccesoVigente(
        { estado: "PAST_DUE", fechaRenovacion: "2026-09-01T20:00:00Z" },
        false,
        AHORA,
      ),
    ).toBe(true);
  });

  it("bloquea con PAST_DUE pasada la gracia", () => {
    expect(
      tieneAccesoVigente({ estado: "PAST_DUE", fechaRenovacion: YA_PASADA }, false, AHORA),
    ).toBe(false);
  });

  it("bloquea con suscripción VENCIDA sin cortesía", () => {
    expect(
      tieneAccesoVigente({ estado: "VENCIDA", fechaRenovacion: EN_CURSO }, false, AHORA),
    ).toBe(false);
  });

  it("bloquea con suscripción CANCELADA sin cortesía", () => {
    expect(
      tieneAccesoVigente({ estado: "CANCELADA", fechaRenovacion: EN_CURSO }, false, AHORA),
    ).toBe(false);
  });

  it("bloquea una ACTIVA cuyo periodo ya terminó — el candado del video", () => {
    // Es el caso real del MVP por códigos: nadie mueve la fila a VENCIDA
    // cuando se acaban los días que otorgó la invitación.
    expect(
      tieneAccesoVigente({ estado: "ACTIVA", fechaRenovacion: YA_PASADA }, false, AHORA),
    ).toBe(false);
  });

  it("permite sin suscripción si hay una cortesía al curso", () => {
    expect(tieneAccesoVigente(null, true, AHORA)).toBe(true);
  });

  it("bloquea sin suscripción y sin cortesía", () => {
    expect(tieneAccesoVigente(null, false, AHORA)).toBe(false);
  });
});
