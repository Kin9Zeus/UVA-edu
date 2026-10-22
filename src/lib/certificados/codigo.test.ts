import { describe, expect, it } from "vitest";
import { formatearCodigoCertificadoEscribiendo, normalizarCodigoCertificado } from "@/lib/certificados/codigo";

describe("formatearCodigoCertificadoEscribiendo", () => {
  it("pasa a mayúsculas y descarta lo que no es letra o número", () => {
    expect(formatearCodigoCertificadoEscribiendo("k7m 2q")).toBe("K7M2Q-");
  });

  it("pone el guion solo al llegar a 5 y deja seguir escribiendo", () => {
    expect(formatearCodigoCertificadoEscribiendo("K7M2")).toBe("K7M2");
    expect(formatearCodigoCertificadoEscribiendo("K7M2Q")).toBe("K7M2Q-");
    expect(formatearCodigoCertificadoEscribiendo("K7M2Q-X")).toBe("K7M2Q-X");
  });

  it("no pasa de 10 caracteres", () => {
    expect(formatearCodigoCertificadoEscribiendo("k7m2qxp4tbzzz")).toBe("K7M2Q-XP4TB");
  });

  it("al borrar no deja el guion colgando", () => {
    expect(formatearCodigoCertificadoEscribiendo("K7M2Q-", true)).toBe("K7M2Q");
  });
});

describe("normalizarCodigoCertificado", () => {
  it("deja igual un código ya bien escrito", () => {
    expect(normalizarCodigoCertificado("K7M2Q-XP4TB")).toBe("K7M2Q-XP4TB");
  });

  it("pasa a mayúsculas y quita espacios", () => {
    expect(normalizarCodigoCertificado("  k7m2q-xp4tb ")).toBe("K7M2Q-XP4TB");
    expect(normalizarCodigoCertificado("k7m2q xp4tb")).toBe("K7M2Q-XP4TB");
  });

  it("pone el guion si son 10 caracteres sin él", () => {
    expect(normalizarCodigoCertificado("K7M2QXP4TB")).toBe("K7M2Q-XP4TB");
  });

  it("no toca otros formatos, como los códigos de siembra", () => {
    expect(normalizarCodigoCertificado("uva-2026-revit-7f3a9c2e")).toBe("UVA-2026-REVIT-7F3A9C2E");
    expect(normalizarCodigoCertificado("ABC12")).toBe("ABC12");
  });

  it("devuelve vacío si no hay nada escrito", () => {
    expect(normalizarCodigoCertificado("   ")).toBe("");
  });
});
