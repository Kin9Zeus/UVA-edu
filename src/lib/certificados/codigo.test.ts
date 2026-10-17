import { describe, expect, it } from "vitest";
import { normalizarCodigoCertificado } from "@/lib/certificados/codigo";

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
