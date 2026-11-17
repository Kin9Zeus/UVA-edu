import { describe, expect, it } from "vitest";
import {
  VERSION_CONSENTIMIENTO,
  esCookieDeAnalitica,
  leerConsentimiento,
  serializarConsentimiento,
} from "@/lib/consentimiento";

const FECHA = new Date("2026-11-17T15:00:00Z");

describe("leerConsentimiento", () => {
  it("devuelve la decisión guardada", () => {
    expect(leerConsentimiento(serializarConsentimiento("aceptada", FECHA))).toBe("aceptada");
    expect(leerConsentimiento(serializarConsentimiento("rechazada", FECHA))).toBe("rechazada");
  });

  it("sin decisión, el aviso sale (null)", () => {
    expect(leerConsentimiento(null)).toBeNull();
    expect(leerConsentimiento("")).toBeNull();
  });

  it("una versión anterior deja de valer: hay que volver a preguntar", () => {
    const vieja = JSON.stringify({ decision: "aceptada", version: VERSION_CONSENTIMIENTO - 1, fecha: FECHA });
    expect(leerConsentimiento(vieja)).toBeNull();
  });

  it.each(["{", "null", "42", '{"decision":"si","version":1}', '"aceptada"'])(
    "un dato roto no cuenta como aceptado: %s",
    (dato) => {
      expect(leerConsentimiento(dato)).toBeNull();
    },
  );
});

describe("serializarConsentimiento", () => {
  it("guarda la decisión con su versión y fecha", () => {
    expect(JSON.parse(serializarConsentimiento("aceptada", FECHA))).toEqual({
      decision: "aceptada",
      version: VERSION_CONSENTIMIENTO,
      fecha: "2026-11-17T15:00:00.000Z",
    });
  });
});

describe("esCookieDeAnalitica", () => {
  it.each(["_ga", "_ga_ABC123", "_gid", "_clck", "_clsk"])("borra %s", (nombre) => {
    expect(esCookieDeAnalitica(nombre)).toBe(true);
  });

  it.each(["sb-access-token", "uva-sidebar-colapsado", "uva-panel-clase", "_gat_x_y_z_", "ga"])(
    "no toca %s",
    (nombre) => {
      expect(esCookieDeAnalitica(nombre)).toBe(false);
    },
  );
});
