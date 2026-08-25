import { describe, expect, it } from "vitest";
import { tieneAccesoVigente } from "@/lib/mux/acceso";

describe("tieneAccesoVigente", () => {
  it("permite con suscripción ACTIVA aunque no haya inscripción", () => {
    expect(tieneAccesoVigente({ estado: "ACTIVA" }, false)).toBe(true);
  });

  it("permite con suscripción PAST_DUE (período de gracia)", () => {
    expect(tieneAccesoVigente({ estado: "PAST_DUE" }, false)).toBe(true);
  });

  it("bloquea con suscripción VENCIDA sin inscripción", () => {
    expect(tieneAccesoVigente({ estado: "VENCIDA" }, false)).toBe(false);
  });

  it("bloquea con suscripción CANCELADA sin inscripción", () => {
    expect(tieneAccesoVigente({ estado: "CANCELADA" }, false)).toBe(false);
  });

  it("permite sin suscripción si hay inscripción (cortesía o membresía puntual)", () => {
    expect(tieneAccesoVigente(null, true)).toBe(true);
  });

  it("bloquea sin suscripción y sin inscripción", () => {
    expect(tieneAccesoVigente(null, false)).toBe(false);
  });
});
