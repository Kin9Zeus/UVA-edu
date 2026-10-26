import { describe, expect, it } from "vitest";
import {
  extraerCodigoCertificado,
  formatearCodigoCertificadoEscribiendo,
  normalizarCodigoCertificado,
} from "@/lib/certificados/codigo";

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

describe("extraerCodigoCertificado (lo que se pega en el campo)", () => {
  it("toma el código del enlace del QR", () => {
    expect(extraerCodigoCertificado("https://uva.test/verificar-certificado/K7M2Q-XP4TB")).toBe("K7M2Q-XP4TB");
    expect(extraerCodigoCertificado("https://uva.test/verificar-certificado/k7m2q%20xp4tb?x=1")).toBe("K7M2Q-XP4TB");
  });

  it("no pierde el último carácter si viene con espacios del PDF", () => {
    expect(extraerCodigoCertificado(" K7M2Q-XP4TB ")).toBe("K7M2Q-XP4TB");
    expect(extraerCodigoCertificado("K7M2Q-XP4TB.")).toBe("K7M2Q-XP4TB");
  });

  it("encuentra el código entre otras palabras", () => {
    expect(extraerCodigoCertificado("Código: k7m2q xp4tb")).toBe("K7M2Q-XP4TB");
    expect(extraerCodigoCertificado("k7m2qxp4tb")).toBe("K7M2Q-XP4TB");
  });

  it("no corta los códigos de siembra", () => {
    expect(extraerCodigoCertificado("UVA-2026-REVIT-7F3A9C2E")).toBe("UVA-2026-REVIT-7F3A9C2E");
    expect(extraerCodigoCertificado("https://uva.test/verificar-certificado/UVA-2026-REVIT-7F3A9C2E")).toBe(
      "UVA-2026-REVIT-7F3A9C2E",
    );
  });
});
